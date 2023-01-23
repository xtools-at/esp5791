/*
 * @title ESP-5791
 * @note Physical Backed Tokens (EIP-5791) for everyone using ESP32 and BLE
 * @version 0.1
 * @author Martin Kainzbauer <m.kainzbauer@xtools.at>
 * @license MIT
 * @copyright 2023
 */

// Debugging flags - disable for production!
#define DEBUG_SERIAL 1
#define DEBUG_RESET 0 // set to 1 to clear storage and generate new private key on boot

// Arduino platform includes
#include <Arduino.h>
#include <EEPROM.h>
// - Mbed TLS: secure private key generation
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/entropy.h>

// Web3E (incl. trezor-crypto): Ethereum keys and signatures
#include <Util.h>
#include <Trezor/secp256k1.h>
#include <Trezor/ecdsa.h>
// Lightweight BLE lib for ESP32 (default Arduino lib uses 60% [!!] ROM storage on a ESP32v1)
#include <NimBLEDevice.h>

using namespace std;

// BLE server setup
#define BLE_SERVER_NAME "ESP-5791" // update to change broadcasted device name
#define BLE_SERVICE_UUID "5791"
// #define BLE_DESCRIPTOR_DESCRIPTION_UUID "2901"
const string BLE_DEFAULT_TEXT_WRITE = "WRITE message via bluetooth to get signature";
NimBLEServer *pServer = NULL;
NimBLECharacteristic *pCharPubkey = NULL;
NimBLECharacteristic *pCharAddress = NULL;
NimBLECharacteristic *pCharSignature = NULL;
NimBLECharacteristic *pCharWritePayload = NULL;
NimBLECharacteristic *pCharWritePayloadHashed = NULL;
NimBLECharacteristic *pCharHashedPayload = NULL;
NimBLECharacteristic *pCharMessageHash = NULL;

// Ethereum length constants
#define ETH_CHECKSUM_ADDRESS_LENGTH (2 + 40 + 1)
#define ETH_PRIVATEKEY_LENGTH (32)
#define ETH_PUBLICKEY_LENGTH (64)
#define ETH_ADDRESS_LENGTH (20)
#define ETH_KECCAK256_LENGTH (32)
#define ETH_SIGNATURE_LENGTH (64)
#define ETH_RECOVERABLE_SIGNATURE_LENGTH (ETH_SIGNATURE_LENGTH + 1)

// EEPROM storage
#define EEPROM_SIZE (512)
// - The keccak256(privateKey)
#define EEPROM_DATA_OFFSET_CHECKSUM (0)
#define EEPROM_DATA_LENGTH_CHECKSUM (ETH_KECCAK256_LENGTH)
// - The secret key (symmetric) used for phone to send encrypted messages
#define EEPROM_DATA_OFFSET_PAIR_SECRET (EEPROM_DATA_OFFSET_CHECKSUM + EEPROM_DATA_LENGTH_CHECKSUM)
#define EEPROM_DATA_LENGTH_PAIR_SECRET (16)
// - The address of the private key
#define EEPROM_DATA_OFFSET_ADDRESS (EEPROM_DATA_OFFSET_PAIR_SECRET + EEPROM_DATA_LENGTH_PAIR_SECRET)
#define EEPROM_DATA_LENGTH_ADDRESS (ETH_ADDRESS_LENGTH)
// - The wallet URI (checksummed address with "ethereum:" scheme)
#define EEPROM_DATA_OFFSET_ADDRESS_URI (EEPROM_DATA_OFFSET_ADDRESS + EEPROM_DATA_LENGTH_ADDRESS)
#define EEPROM_DATA_LENGTH_ADDRESS_URI (9 + ETH_CHECKSUM_ADDRESS_LENGTH)
// - The public key
#define EEPROM_DATA_OFFSET_PUBLIC (EEPROM_DATA_OFFSET_ADDRESS_URI + EEPROM_DATA_LENGTH_ADDRESS_URI)
#define EEPROM_DATA_LENGTH_PUBLIC (ETH_PUBLICKEY_LENGTH)
// - The private key
#define EEPROM_DATA_OFFSET_SECRET (EEPROM_DATA_OFFSET_PUBLIC + EEPROM_DATA_LENGTH_PUBLIC)
#define EEPROM_DATA_LENGTH_SECRET (ETH_PRIVATEKEY_LENGTH)
// - Boot flag
#define EEPROM_DATA_OFFSET_BOOT (EEPROM_DATA_OFFSET_SECRET + EEPROM_DATA_LENGTH_SECRET)
#define EEPROM_DATA_LENGTH_BOOT (4)

// Eth prefixes
const char ADDRESS_URI_PREFIX[] PROGMEM = {
    'e', 't', 'h', 'e', 'r', 'e', 'u', 'm', ':'};
const char *PERSONAL_MESSAGE_PREFIX_32 = "0x19457468657265756d205369676e6564204d6573736167653a0a3332";

/* System - errors and storage */
typedef enum ErrorCode
{
    ErrorCodeNone = 0,
    ErrorCodeOutOfMemory = 31,
    ErrorCodeSigningError = 41,
    ErrorCodeInvalidKey = 42,
    ErrorCodeStorageFailed = 51,
} ErrorCode;

static void crash(ErrorCode errorCode, uint16_t lineNo)
{
    if (DEBUG_SERIAL)
        Serial.println(String("--- xXx --- CRASH! --- xXx --- // line: ") + String(lineNo) + "; code: " + errorCode);
}

static bool equalsStorage(uint16_t offset, uint16_t length, uint8_t *buffer)
{
    for (uint16_t i = 0; i < length; i++)
    {
        if (buffer[i] != EEPROM.read((offset + i)))
        {
            return false;
        }
    }
    return true;
}

static void readStorage(uint16_t offset, uint16_t length, uint8_t *buffer)
{
    for (uint16_t i = 0; i < length; i++)
    {
        buffer[i] = EEPROM.read((offset + i));
    }
}

static void writeStorage(uint16_t offset, uint16_t length, uint8_t *buffer)
{
    for (uint16_t i = 0; i < length; i++)
    {
        EEPROM.write((offset + i), buffer[i]);
    }
    EEPROM.commit();

    delay(100);

    // Make sure the data was written correctly
    if (!equalsStorage(offset, length, buffer))
    {
        crash(ErrorCodeStorageFailed, __LINE__);
    }
}

void clearStorage()
{
    if (DEBUG_SERIAL)
        Serial.println("\n--- CLEARING STORAGE ---\n");
    for (int i = 0; i < EEPROM_SIZE; i++)
    {
        EEPROM.write(i, '0');
    }
    EEPROM.commit();
    delay(500);
}

/* Utils interface - plug & play your own lib */
string util_convertBytesToHex(const uint8_t *bytes, int length)
{
    return Util::ConvertBytesToHex(bytes, length);
}

void util_convertHexToBytes(uint8_t *_dst, const char *_src, int length)
{
    Util::ConvertHexToBytes(_dst, _src, length);
}

/* Crypto interface - plug & play your own lib  */
bool eth_sign(uint8_t *digest, size_t len, uint8_t *sig)
{
    if (DEBUG_SERIAL)
        Serial.println(String("\n[eth_sign] "));
    const ecdsa_curve *curve = &secp256k1;
    uint8_t pby;
    int res = 0;
    bool allZero = true;

    // get private key
    uint8_t privateKey[ETH_PRIVATEKEY_LENGTH];
    readStorage(EEPROM_DATA_OFFSET_SECRET, EEPROM_DATA_LENGTH_SECRET, privateKey);
    // if (DEBUG_SERIAL) Serial.println(String(" - read private key: ") + util_convertBytesToHex(privateKey, ETH_PRIVATEKEY_LENGTH).c_str());

    // sign
    for (int i = 0; i < ETH_PRIVATEKEY_LENGTH; i++)
        if (privateKey[i] != 0)
            allZero = false;
    if (allZero == true)
    {
        crash(ErrorCodeInvalidKey, __LINE__);
    }
    else
    {
        res = ecdsa_sign_digest(curve, (const uint8_t *)privateKey, (const uint8_t *)digest, sig, &pby, NULL);
        // original implementation in Web3E:
        // sig[64] = pby;

        // PATCH: fix recovery bit for Solidity (may break "regular" ecrecover)
        sig[ETH_RECOVERABLE_SIGNATURE_LENGTH - 1] = (pby == 0x00) ? 0x1b : 0x1c;
    }

    // cleanup
    memset(privateKey, 0, sizeof(privateKey));

    return allZero ? false : (res > -1);
}

void eth_privateKeyToPublic(const uint8_t *privateKey, uint8_t *publicKey)
{
    uint8_t buffer[ETH_PUBLICKEY_LENGTH + 1];
    const ecdsa_curve *curve = &secp256k1;
    ecdsa_get_public_key65(curve, privateKey, buffer);
    memcpy(publicKey, buffer + 1, ETH_PUBLICKEY_LENGTH);
}

void eth_publicKeyToAddress(const uint8_t *publicKey, uint8_t *address)
{
    uint8_t hashed[ETH_KECCAK256_LENGTH];
    eth_keccak256(publicKey, ETH_PUBLICKEY_LENGTH, hashed);
    memcpy(address, &hashed[12], ETH_ADDRESS_LENGTH);
}

void eth_keccak256(const uint8_t *data, uint16_t length, uint8_t *result)
{
    keccak_256(data, length, result);
}

/* Ethereum signed messages using the interfaces above */
string eth_signMessage(const uint8_t *message, size_t len)
{
    // Hash the message
    uint8_t digest[ETH_KECCAK256_LENGTH];
    eth_keccak256(message, len, digest);

    if (DEBUG_SERIAL)
        Serial.println(String("\n > sign: hashed plaintext message: ") + util_convertBytesToHex(digest, ETH_KECCAK256_LENGTH).c_str());

    return eth_signHashedMessage(digest);
}

string eth_signMessage(string payload, bool isHashed)
{
    // convert message to bytes
    const char *message = payload.c_str();
    size_t len = strlen(message);

    if (DEBUG_SERIAL)
        Serial.println(String("\n > sign: converting message to bytes: ") + message + (isHashed ? " (hashed)" : " (plaintext)"));

    if (isHashed)
    {
        uint8_t hash[len];
        util_convertHexToBytes((uint8_t *)hash, message, len);
        return eth_signHashedMessage(hash);
    }
    else
    {
        return eth_signMessage((uint8_t *)message, len);
    }
}

string eth_signHashedMessage(const uint8_t *digest)
{
    if (DEBUG_SERIAL)
        Serial.println(String("\n[eth_signHashedMessage]"));

    // create the challenge
    string dig = util_convertBytesToHex(digest, ETH_KECCAK256_LENGTH);
    string challenge = PERSONAL_MESSAGE_PREFIX_32 + dig.substr(2, ETH_KECCAK256_LENGTH * 2 + 1);
    const char *challengeStr = challenge.c_str();
    uint8_t challengeBytes[60];
    if (DEBUG_SERIAL)
        Serial.println(" - created challenge");

    // hash the challenge
    uint8_t challengeHash[ETH_KECCAK256_LENGTH];
    util_convertHexToBytes((uint8_t *)challengeBytes, challengeStr, 60);
    eth_keccak256((uint8_t *)challengeBytes, 60, challengeHash);

    // sign challenge
    uint8_t signature[ETH_RECOVERABLE_SIGNATURE_LENGTH];
    eth_sign(challengeHash, ETH_KECCAK256_LENGTH, signature);
    if (DEBUG_SERIAL)
        Serial.println(String(" - signed hashed challenge: ") + util_convertBytesToHex(challengeHash, ETH_KECCAK256_LENGTH).c_str());
    string sig = util_convertBytesToHex(signature, ETH_RECOVERABLE_SIGNATURE_LENGTH);
    if (DEBUG_SERIAL)
        Serial.println(String(" - signature: ") + sig.c_str());

    // set BLE values
    pCharSignature->setValue(sig);
    pCharMessageHash->setValue(util_convertBytesToHex(challengeHash, ETH_KECCAK256_LENGTH));
    pCharHashedPayload->setValue(dig);

    return sig;
}

/* Wallet setup */
static void bootstrap()
{
    uint8_t boot[4] = {0xde, 0xad, 0xbe, 0xef};

    if (DEBUG_SERIAL)
    {
        Serial.println("\n[bootstrap] ");
    }

    // Already generated all the cached data (note: this is written last like a journal commit)
    if (equalsStorage(EEPROM_DATA_OFFSET_BOOT, EEPROM_DATA_LENGTH_BOOT, boot))
    {
        if (DEBUG_SERIAL)
        {
            Serial.println(" - keys already generated");

            // read public key and address
            uint8_t address[ETH_ADDRESS_LENGTH];
            readStorage(EEPROM_DATA_OFFSET_ADDRESS, EEPROM_DATA_LENGTH_ADDRESS, address);
            if (DEBUG_SERIAL)
                Serial.println(String(" - address   : ") + util_convertBytesToHex(address, ETH_ADDRESS_LENGTH).c_str());

            uint8_t pubkey[ETH_PUBLICKEY_LENGTH];
            readStorage(EEPROM_DATA_OFFSET_PUBLIC, EEPROM_DATA_LENGTH_PUBLIC, pubkey);
            if (DEBUG_SERIAL)
                Serial.println(String(" - public key: ") + util_convertBytesToHex(pubkey, ETH_PUBLICKEY_LENGTH).c_str());
        }

        return;
    }

    // create random private key
    // - setup
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;
    uint8_t privateKey[ETH_PRIVATEKEY_LENGTH];
    const char *additionalSeed = (String(ESP.getEfuseMac()) + String(ESP.getFreeHeap()) + String("created_by_xtools")).c_str();
    // - generate
    mbedtls_entropy_init(&entropy);
    mbedtls_ctr_drbg_init(&ctr_drbg);
    mbedtls_ctr_drbg_seed(&ctr_drbg, mbedtls_entropy_func, &entropy, (uint8_t *)additionalSeed, strlen(additionalSeed));
    mbedtls_ctr_drbg_random(&ctr_drbg, privateKey, ETH_PRIVATEKEY_LENGTH);
    // - cleanup
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);

    // init the largest amount of memory we need for anything we cache
    uint8_t scratch[EEPROM_DATA_LENGTH_PUBLIC];

    // *********
    // compute checksum
    uint8_t checksum[ETH_PRIVATEKEY_LENGTH];
    eth_keccak256(privateKey, ETH_PRIVATEKEY_LENGTH, checksum);

    // *********
    // Compute the pairing secret keccak(0x00 || keccak(privateKey))[:16]
    // eth_keccak256(checksum, ETH_KECCAK256_LENGTH, &scratch[ETH_KECCAK256_LENGTH + 1]);
    // scratch[ETH_KECCAK256_LENGTH] = 0;
    // eth_keccak256(&scratch[ETH_KECCAK256_LENGTH], ETH_KECCAK256_LENGTH + 1, scratch);
    // writeStorage(EEPROM_DATA_OFFSET_PAIR_SECRET, EEPROM_DATA_LENGTH_PAIR_SECRET, scratch);

    // *********
    // Compute private and public key and wallet address
    writeStorage(EEPROM_DATA_OFFSET_SECRET, EEPROM_DATA_LENGTH_SECRET, privateKey);
    if (DEBUG_SERIAL)
        Serial.println("- stored generated private key");

    // - pubkey
    uint8_t pubKey[ETH_PUBLICKEY_LENGTH];
    eth_privateKeyToPublic(privateKey, pubKey);
    writeStorage(EEPROM_DATA_OFFSET_PUBLIC, EEPROM_DATA_LENGTH_PUBLIC, pubKey);
    if (DEBUG_SERIAL)
        Serial.println("- created and stored public key");

    // - address
    // -- compute the address (leave some space at the beginning for the URI scheme in the next part)
    eth_publicKeyToAddress(pubKey, &scratch[9]);
    writeStorage(EEPROM_DATA_OFFSET_ADDRESS, EEPROM_DATA_LENGTH_ADDRESS, &scratch[9]);
    if (DEBUG_SERIAL)
        Serial.println(String("- created and stored wallet address: ") + util_convertBytesToHex(&scratch[9], ETH_ADDRESS_LENGTH).c_str());

    // *********
    // Generate the wallet URI ("ethereum:" + checksumAddress);
    // memcpy_P(scratch, ADDRESS_URI_PREFIX, 9);
    // Place the null-terminated, checksum address into the string after the "ethereum:"
    // ethers_addressToChecksumAddress(&scratch[9], (char*)&scratch[9]);
    // writeStorage(EEPROM_DATA_OFFSET_ADDRESS_URI, EEPROM_DATA_LENGTH_ADDRESS_URI, scratch);

    // *********
    // write checksum address and boot flag last
    writeStorage(EEPROM_DATA_OFFSET_CHECKSUM, EEPROM_DATA_LENGTH_CHECKSUM, checksum);
    writeStorage(EEPROM_DATA_OFFSET_BOOT, EEPROM_DATA_LENGTH_BOOT, boot);

    // cleanup
    memset(privateKey, 0, sizeof(privateKey));
}

/* Arduino platform */
void setup()
{

#if DEBUG_SERIAL == 1
    Serial.begin(115200);
    while (!Serial)
    {
    }
    Serial.println("\n");
#endif

    // enable EEPROM *first*
    EEPROM.begin(EEPROM_SIZE);
    delay(300);

    // setup wallet
    if (DEBUG_RESET)
    {
        // switch flag and re-flash to reset keys on boot
        clearStorage();
    }
    bootstrap();

    // setup BLE - needs to run *after* wallet bootstrap
    setupBleServer();

    if (DEBUG_SERIAL)
    {
        // sign test message
        Serial.println("\n[DEBUG - Signature test]");
        string testMsg = "ABC123"; // keccak256: 0xdbb28303106dbfbadda4b9d1faf44c80368b4b8a4b642550fd48b760a61a9c12
        eth_signMessage(testMsg, false);
    }
}

void loop()
{
    // debounce
    delay(50);
}

/* BLE */
class PlaintextMessageCallbacks : public NimBLECharacteristicCallbacks
{
    void onWrite(NimBLECharacteristic *pCharacteristic)
    {
        // get hex string message
        string plainPayload = pCharacteristic->getValue();
        if (DEBUG_SERIAL)
            Serial.println(String("\n > BLE: received plaintext payload: ") + plainPayload.c_str());

        // hash and sign message
        eth_signMessage(plainPayload, false);

        if (pServer->getConnectedCount() > 0)
        {
            pCharSignature->notify();
            delay(5);
            pCharMessageHash->notify();
            delay(5);
            pCharHashedPayload->notify();
            delay(5);
        }
        // reset payload characteristic
        pCharWritePayload->setValue(BLE_DEFAULT_TEXT_WRITE);
    }
};

class HashedMessageCallbacks : public NimBLECharacteristicCallbacks
{
    void onWrite(NimBLECharacteristic *pCharacteristic)
    {
        // get hex string message
        string hashedPayload = pCharacteristic->getValue();
        if (DEBUG_SERIAL)
            Serial.println(String("\n > BLE: received hashed payload: ") + hashedPayload.c_str());

        // sign hashed message
        eth_signMessage(hashedPayload, true);

        if (pServer->getConnectedCount() > 0)
        {
            pCharSignature->notify(true);
            delay(5);
            pCharMessageHash->notify(true);
            delay(5);
            pCharHashedPayload->notify(true);
            delay(5);
        }
        // reset hashed payload characteristic
        pCharWritePayloadHashed->setValue(BLE_DEFAULT_TEXT_WRITE);
    }
};

void setupBleServer()
{
    // init
    NimBLEDevice::init(BLE_SERVER_NAME);

    /*
    // NimBLE specific settings
    #ifdef ESP_PLATFORM
        NimBLEDevice::setPower(ESP_PWR_LVL_P9); // +9db
    #else
        NimBLEDevice::setPower(9); // +9db
    #endif
    NimBLEDevice::setSecurityAuth(false, false, true);
    */

    pServer = NimBLEDevice::createServer();
    NimBLEService *pService = pServer->createService(BLE_SERVICE_UUID);
    // NimBLEUUID descriptorUuid = NimBLEUUID(BLE_DESCRIPTOR_DESCRIPTION_UUID);

    // get public Eth values to broadcast
    uint8_t address[ETH_ADDRESS_LENGTH];
    readStorage(EEPROM_DATA_OFFSET_ADDRESS, EEPROM_DATA_LENGTH_ADDRESS, address);
    uint8_t pubkey[ETH_PUBLICKEY_LENGTH];
    readStorage(EEPROM_DATA_OFFSET_PUBLIC, EEPROM_DATA_LENGTH_PUBLIC, pubkey);

    // BLE service characteristics
    // - readonly: public key
    pCharPubkey = pService->createCharacteristic("A001", NIMBLE_PROPERTY::READ, 256);
    pCharPubkey->setValue(util_convertBytesToHex(pubkey, ETH_PUBLICKEY_LENGTH));
    // NimBLEDescriptor descPubkey(descriptorUuid, NIMBLE_PROPERTY::READ, 128);
    // descPubkey.setValue("Info: Public Key");
    // pCharPubkey->addDescriptor(&descPubkey);

    // - readonly: wallet address
    pCharAddress = pService->createCharacteristic("A002", NIMBLE_PROPERTY::READ, 256);
    pCharAddress->setValue(util_convertBytesToHex(address, ETH_ADDRESS_LENGTH));
    // NimBLEDescriptor descAddress(descriptorUuid, NIMBLE_PROPERTY::READ, 128);
    // descAddress.setValue("Info: Wallet address");
    // pCharAddress->addDescriptor(&descAddress);

    // - input: plaintext payload
    pCharWritePayload = pService->createCharacteristic("B001", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE, 256);
    pCharWritePayload->setCallbacks(new PlaintextMessageCallbacks());
    pCharWritePayload->setValue(BLE_DEFAULT_TEXT_WRITE);
    // NimBLEDescriptor descPayload(descriptorUuid, NIMBLE_PROPERTY::READ, 128);
    // descPayload.setValue("Input: WRITE plaintext message to sign here");
    // pCharWritePayload->addDescriptor(&descPayload);

    // - input: hashed payload
    pCharWritePayloadHashed = pService->createCharacteristic("B002", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE, 256);
    pCharWritePayloadHashed->setCallbacks(new HashedMessageCallbacks());
    pCharWritePayloadHashed->setValue(BLE_DEFAULT_TEXT_WRITE);
    // NimBLEDescriptor descPayloadHashed(descriptorUuid, NIMBLE_PROPERTY::READ, 128);
    // descPayloadHashed.setValue("Input: WRITE keccak256-hashed message to sign here");
    // pCharWritePayloadHashed->addDescriptor(&descPayloadHashed);

    // - output: signature
    pCharSignature = pService->createCharacteristic("C001", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY, 256);
    pCharSignature->setValue(string("Signature will appear here"));
    // NimBLEDescriptor descSignature(descriptorUuid, NIMBLE_PROPERTY::READ, 128);
    // descSignature.setValue("Output: Signature");
    // pCharSignature->addDescriptor(&descSignature);

    // - output: signed ETH-message hash
    pCharMessageHash = pService->createCharacteristic("C002", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY, 256);
    pCharMessageHash->setValue(string("Signed message hash will appear here"));
    // NimBLEDescriptor descMessageHash(descriptorUuid, NIMBLE_PROPERTY::READ, 128);
    // descMessageHash.setValue("Output: Signed message hash");
    // pCharMessageHash->addDescriptor(&descMessageHash);

    // - output: hashed payload
    pCharHashedPayload = pService->createCharacteristic("C008", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY, 256);
    pCharHashedPayload->setValue(string("Keccak-256 hashed payload will appear here"));
    // NimBLEDescriptor descPayloadHash(descriptorUuid, NIMBLE_PROPERTY::READ, 128);
    // descPayloadHash.setValue("Output: Hashed payload");
    // pCharHashedPayload->addDescriptor(&descPayloadHash);

    // start BLE advertising
    pService->start();
    NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    pAdvertising->start();
}

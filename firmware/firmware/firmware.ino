#include "src/env.h"  // Contiene WIFI_SSID, WIFI_PASSWORD, API_URL

#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>

#undef NULL
#define NULL 0

#include <WiFi.h>
#include <HTTPClient.h>
#include "NfcAdapter.h"
#include <time.h>

// Pines
#define LED_R 14
#define LED_G 15
#define LED_B 16
#define BUZZER_PIN 4 // Buzzer pasivo

// Estados del sistema
enum SystemState {
  STATE_WAITING,
  STATE_PROCESSING,
  STATE_SUCCESS,
  STATE_ERROR,
  STATE_INIT,
  STATE_PARTY
};

SystemState currentState = STATE_INIT;
unsigned long lastStateChange = 0;
const unsigned long STATE_DELAY = 2000;
const unsigned long ERROR_DELAY = 800; // Más corto para error
unsigned long lastAnimationTime = 0;

// NFC
PN532_I2C pn532_i2c(Wire);
NfcAdapter nfc = NfcAdapter(pn532_i2c);

// Animación de color
float hue = 0.0;
int rCurr = 0, gCurr = 0, bCurr = 0;

// ------------------- Buzzer no bloqueante -------------------
unsigned long lastBeepTime = 0;
bool buzzerOn = false;
const int beepInterval = 200; // ms, duración de cada beep en PROCESSING

// ------------------- Gestión de Tags -------------------
String lastTagUid = "";
unsigned long lastTagTime = 0;
const unsigned long TAG_COOLDOWN = 3000; // 3 segundos entre lecturas

// ------------------- Declaraciones de funciones -------------------
void connectWiFi();
void syncTime();
void setState(SystemState newState);
void setColor(int r, int g, int b);
String getTagUid(NfcTag &tag);

// ------------------- Clase WiFi Manager -------------------
class WiFiManager {
private:
  unsigned long lastCheck = 0;
  const unsigned long CHECK_INTERVAL = 15000; // 15 segundos
  int connectionAttempts = 0;
  const int MAX_ATTEMPTS = 3;

public:
  bool ensureConnected() {
    if (WiFi.status() == WL_CONNECTED) {
      connectionAttempts = 0; // Reset contador si está conectado
      return true;
    }

    if (millis() - lastCheck > CHECK_INTERVAL) {
      lastCheck = millis();
      
      if (connectionAttempts < MAX_ATTEMPTS) {
        Serial.println("🔁 Reconectando WiFi...");
        connectWiFi();
        connectionAttempts++;
      } else {
        Serial.println("🚨 Múltiples fallos de WiFi, reiniciando...");
        ESP.restart();
      }
    }
    return false;
  }
};

WiFiManager wifiManager;

// ------------------- Funciones buzzer -------------------
void playTone(int freq, int duration) {
  tone(BUZZER_PIN, freq, duration);
  delay(duration * 1.1);
  noTone(BUZZER_PIN);
}

void buzzerFeedback(SystemState state) {
  switch (state) {
    case STATE_SUCCESS:
      playTone(880, 100);
      playTone(1320, 150);
      break;

    case STATE_ERROR:
      playTone(220, 200);
      delay(100);
      playTone(220, 200);
      break;

    case STATE_WAITING:
    case STATE_INIT:
    case STATE_PARTY:
      // silencioso
      break;

    case STATE_PROCESSING:
      // ahora usamos buzzer no bloqueante en loop
      break;
  }
}

// ------------------- Setup -------------------
void setup() {
  Serial.begin(115200);
  Serial.println("🚀 Iniciando lector NFC...");

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  setColor(0, 0, 0); // Blanco = iniciando (0,0,0 = encendido para RGB)
  connectWiFi();
  syncTime();

  nfc.begin();

  setState(STATE_WAITING);
}

// ------------------- Loop principal -------------------
void loop() {
  unsigned long now = millis();

  // Animación LEDs
  animateLEDs(now);

  // Buzzer no bloqueante en PROCESSING
  if (currentState == STATE_PROCESSING) {
    if (now - lastBeepTime >= beepInterval) {
      lastBeepTime = now;
      buzzerOn = !buzzerOn;
      if (buzzerOn) tone(BUZZER_PIN, 600);
      else noTone(BUZZER_PIN);
    }
  } else {
    noTone(BUZZER_PIN);  // asegurarse de apagar buzzer en otros estados
  }

  // Verificación WiFi mejorada
  if (!wifiManager.ensureConnected() && currentState == STATE_PROCESSING) {
    setState(STATE_ERROR);
    return;
  }

  // Debug info periódica
  debugSystemInfo();

  // Manejo estados
  switch (currentState) {
    case STATE_WAITING:
      if (shouldProcessNewTag()) setState(STATE_PROCESSING);
      break;

    case STATE_PROCESSING:
      processTag();
      break;

    case STATE_SUCCESS:
      if (now - lastStateChange > STATE_DELAY) setState(STATE_WAITING);
      break;

    case STATE_ERROR:
      if (now - lastStateChange > ERROR_DELAY) setState(STATE_WAITING);
      break;

    case STATE_PARTY:
      // Puede activarse manualmente para demo
      break;

    case STATE_INIT:
      // transición inicial ya hecha en setup
      break;
  }
}

// ------------------- Gestión Mejorada de Tags -------------------
bool shouldProcessNewTag() {
  if (!nfc.tagPresent()) return false;
  
  NfcTag tag = nfc.read();
  String currentUid = getTagUid(tag);
  unsigned long now = millis();
  
  // Evitar procesar el mismo tag repetidamente
  if (currentUid == lastTagUid && (now - lastTagTime) < TAG_COOLDOWN) {
    Serial.println("⏭️ Tag ya procesado recientemente, ignorando...");
    return false;
  }
  
  lastTagUid = currentUid;
  lastTagTime = now;
  Serial.println("🏷️ Nuevo tag detectado: " + currentUid);
  return true;
}

String getTagUid(NfcTag &tag) {
  String uid = "";
  byte uidBytes[tag.getUidLength()];
  tag.getUid(uidBytes, tag.getUidLength());
  
  for (int i = 0; i < tag.getUidLength(); i++) {
    if (uidBytes[i] < 0x10) uid += "0";
    uid += String(uidBytes[i], HEX);
  }
  return uid;
}

// ------------------- Lógica NFC Mejorada -------------------
void processTag() {
  Serial.println("🔍 Detectado - Leyendo...");

  // Intentar lectura múltiple con timeout
  const unsigned long readTimeout = 2000;
  unsigned long startTime = millis();
  NfcTag tag;
  bool readSuccess = false;

  while (millis() - startTime < readTimeout && !readSuccess) {
    if (nfc.tagPresent()) {
      tag = nfc.read();
      if (tag.getUidLength() > 0) {
        readSuccess = true;
        break;
      }
    }
    delay(50);
  }

  if (!readSuccess) {
    Serial.println("❌ No se pudo leer el tag correctamente");
    setState(STATE_ERROR);
    return;
  }

  if (!tag.hasNdefMessage()) {
    Serial.println("❌ Tag no contiene NDEF");
    setState(STATE_ERROR);
    return;
  }

  NdefMessage message = tag.getNdefMessage();
  int foundIndex = -1;

  for (int i = 0; i < message.getRecordCount(); i++) {
    NdefRecord record = message.getRecord(i);
    if (record.getTnf() == TNF_WELL_KNOWN && record.getType() == "U") {
      String url = getUrlFromRecord(record);
      Serial.println("🔗 URL: " + url);

      foundIndex = getIndexFromUrl(url);
      if (foundIndex >= 0 && foundIndex <= 3) break;
    }
  }

  if (foundIndex >= 0) {
    Serial.println("🎯 Índice: " + String(foundIndex));
    sendToEndpoint(foundIndex);
  } else {
    Serial.println("❌ Índice no válido");
    setState(STATE_ERROR);
  }
}

// ------------------- HTTP Client Mejorado -------------------
bool sendToEndpointWithRetry(int index, int maxRetries = 2) {
  for (int attempt = 1; attempt <= maxRetries; attempt++) {
    Serial.println("📤 Enviando índice " + String(index) + " (Intento " + String(attempt) + ")");
    
    HTTPClient http;
    http.setTimeout(10000); // 10 segundos timeout
    http.setReuse(true);
    
    String payload = "{\"index\":" + String(index) + "}";
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(payload);
    String response = http.getString();
    http.end();

    Serial.println("📡 Código HTTP: " + String(httpCode));
    if (response.length() > 0) {
      Serial.println("📦 Respuesta: " + response);
    }

    if (httpCode == 200) {
      Serial.println("✅ Envío exitoso");
      return true;
    } else if (httpCode == -1) {
      Serial.println("🌐 Error de conexión, reintentando...");
      delay(1000 * attempt); // Backoff exponencial
    } else {
      Serial.println("❌ Error HTTP: " + String(httpCode));
      break; // No reintentar para errores HTTP distintos a timeout
    }
  }
  return false;
}

void sendToEndpoint(int index) {
  noTone(BUZZER_PIN); // Detener sonido inmediatamente

  if (sendToEndpointWithRetry(index)) {
    setState(STATE_SUCCESS);
  } else {
    setState(STATE_ERROR);
  }
}

// ------------------- Extra NFC -------------------
String getUrlFromRecord(NdefRecord &record) {
  byte payload[record.getPayloadLength()];
  record.getPayload(payload);
  String url;

  switch (payload[0]) {
    case 0x01: url = "http://www."; break;
    case 0x02: url = "https://www."; break;
    case 0x03: url = "http://"; break;
    case 0x04: url = "https://"; break;
    default: url = ""; break;
  }

  for (int i = 1; i < record.getPayloadLength(); i++) url += (char)payload[i];
  return url;
}

int getIndexFromUrl(String url) {
  int paramStart = url.indexOf("?nfc=");
  if (paramStart == -1) return -1;

  String indexStr = url.substring(paramStart + 5);
  int ampPos = indexStr.indexOf('&');
  if (ampPos != -1) indexStr = indexStr.substring(0, ampPos);

  return indexStr.toInt();
}

// ------------------- Estados -------------------
void setState(SystemState newState) {
  if (currentState == newState) return;

  currentState = newState;
  lastStateChange = millis();

  buzzerFeedback(newState);

  switch (newState) {
    case STATE_WAITING: Serial.println("⏳ Esperando tarjeta..."); break;
    case STATE_PROCESSING: Serial.println("🔄 Procesando..."); break;
    case STATE_SUCCESS: Serial.println("🎉 Éxito!"); break;
    case STATE_ERROR: Serial.println("💥 Error"); break;
    case STATE_INIT: Serial.println("🚀 Iniciando..."); break;
    case STATE_PARTY: Serial.println("🎊 Fiesta!"); break;
  }
}

// ------------------- Animaciones LEDs -------------------
void animateLEDs(unsigned long now) {
  const int interval = 50;
  if (now - lastAnimationTime < interval) return;
  lastAnimationTime = now;

  switch (currentState) {
    case STATE_WAITING:
      hue += 1.5; if (hue > 360) hue = 0;
      hsvToRgb(hue, 0.6, 0.5, rCurr, gCurr, bCurr);
      setColor(rCurr, gCurr, bCurr);
      break;

    case STATE_PROCESSING:
      pulseColor(0, 55, 255, 500); // Naranja invertido (0,55,255)
      break;

    case STATE_SUCCESS:
      pulseColor(255, 0, 255, 700); // Verde invertido (255,0,255)
      break;

    case STATE_ERROR:
      pulseDoubleRed(300, 100);
      break;

    case STATE_PARTY:
      randomColorFlash();
      break;

    case STATE_INIT:
      fadeToColor(0, 0, 0, 500); // Blanco invertido (0,0,0)
      break;
  }
}

// ------------------- Funciones auxiliares -------------------
void setColor(int r, int g, int b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

void fadeToColor(int targetR, int targetG, int targetB, int duration) {
  rCurr = rCurr + (targetR - rCurr) / 10;
  gCurr = gCurr + (targetG - gCurr) / 10;
  bCurr = bCurr + (targetB - bCurr) / 10;
  setColor(rCurr, gCurr, bCurr);
}

void pulseColor(int r, int g, int b, int pulseTime) {
  int phase = (millis() % pulseTime);
  float factor = phase < (pulseTime / 2) ? (float)phase / (pulseTime/2) : 1.0 - (float)(phase - pulseTime/2) / (pulseTime/2);
  setColor(r * factor, g * factor, b * factor);
}

void pulseDoubleRed(int pulseTime, int pause) {
  int t = millis() % (pulseTime*2 + pause);
  if (t < pulseTime || (t >= pulseTime + pause && t < pulseTime*2 + pause)) setColor(0, 255, 255); // Rojo invertido (0,255,255)
  else setColor(255, 255, 255); // Apagado
}

void randomColorFlash() {
  static int lastChange = 0;
  if (millis() - lastChange > 150) {
    lastChange = millis();
    setColor(random(0,155), random(0,155), random(0,155)); // Valores bajos para colores brillantes
  }
}

// ------------------- HSV → RGB -------------------
void hsvToRgb(float h, float s, float v, int &r, int &g, int &b) {
  int i = int(h / 60.0) % 6;
  float f = h / 60.0 - i;
  float p = v * (1 - s);
  float q = v * (1 - f * s);
  float t = v * (1 - (1 - f) * s);
  float rF, gF, bF;

  switch(i){
    case 0: rF=v; gF=t; bF=p; break;
    case 1: rF=q; gF=v; bF=p; break;
    case 2: rF=p; gF=v; bF=t; break;
    case 3: rF=p; gF=q; bF=v; break;
    case 4: rF=t; gF=p; bF=v; break;
    case 5: rF=v; gF=p; bF=q; break;
  }

  r = int(rF*255);
  g = int(gF*255);
  b = int(bF*255);
}

// ------------------- WiFi y NTP -------------------
void connectWiFi() {
  Serial.println("📡 Conectando WiFi...");
  setColor(0, 0, 255); // Amarillo invertido (0,0,255)

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  unsigned long startAttemptTime = millis();
  const unsigned long timeout = 10000; // 10 segundos por intento
  
  while (WiFi.status() != WL_CONNECTED) {
    // Animación de conexión (parpadeo amarillo invertido)
    static unsigned long lastBlink = 0;
    static bool ledState = false;
    
    if (millis() - lastBlink > 500) {
      lastBlink = millis();
      ledState = !ledState;
      if (ledState) {
        setColor(0, 0, 255); // Amarillo invertido
      } else {
        setColor(255, 255, 255); // Apagado
      }
    }
    
    // Verificar timeout del intento actual
    if (millis() - startAttemptTime > timeout) {
      Serial.println("⏳ Timeout, reintentando conexión WiFi...");
      WiFi.disconnect();
      delay(1001);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      startAttemptTime = millis();
    }
    
    delay(100);
  }
  
  // Conexión exitosa
  Serial.println("\n✅ WiFi conectado: " + WiFi.localIP().toString());
  // Restaurar color del estado actual
  setState(currentState);
}

void syncTime() {
  configTzTime("CST6CDT,M3.2.0/2,M11.1.0/2", "pool.ntp.org", "time.nist.gov");

  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) Serial.printf("⏰ Hora: %02d:%02d:%02d\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
}

// ------------------- Debugging Mejorado -------------------
void debugSystemInfo() {
  static unsigned long lastDebug = 0;
  if (millis() - lastDebug > 30000) { // Cada 30 segundos
    lastDebug = millis();
    
    Serial.println("=== SYSTEM INFO ===");
    Serial.println("Estado: " + String(currentState));
    Serial.println("WiFi: " + String(WiFi.status() == WL_CONNECTED ? "Conectado" : "Desconectado"));
    Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
    Serial.println("Memoria libre: " + String(esp_get_free_heap_size()) + " bytes");
    Serial.println("Último tag: " + lastTagUid);
    Serial.println("Tiempo desde último tag: " + String((millis() - lastTagTime) / 1000) + "s");
    Serial.println("==================");
  }
}
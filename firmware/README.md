# Firmware NFC

Un artefacto que permite la lectura de etiquetas NFC sin necesidad de un teléfono, notificando vía web cuando se detecta un tag.

## Requerimientos

- Placa: Arduino Nano ESP32.
- Módulo NFC: PN532 rojo (4 pines, I²C).
- Transistor: 2N2222A + resistencia (470 Ω – 1 kΩ) para controlar el encendido/apagado del PN532.
- LED RGB incorporado (en este código conectado a pines 14, 15 y 16).
- Alimentación: 3.3 V (del ESP32).
- Conexión a WiFi para enviar notificaciones web.

## Librerías de Arduino necesarias:

- PN532 by Elechouse
- WiFi (WiFi.h)
- HTTPClient (HTTPClient.h)
- NfcAdapter (NfcAdapter.h)

## Conexiones del PN532 rojo

```
Arduino Nano ESP32      PN532 Rojo
-----------------      ------------
3.3V ----------------> VCC
GND (común con emisor del 2N2222) ---+
                                      |
GPIO 5 ---[1kΩ]---> Base 2N2222       |
                                      +--> GND PN532 (colector del 2N2222)
                                   
GPIO A4 --------------> SDA
GPIO A5 --------------> SCL
```

- Explicación: el transistor permite encender/apagar el PN532 mediante el pin PN532_POWER_PIN (GPIO 5).
- Las líneas SDA y SCL se conectan a A4 y A5 del Nano ESP32 para I²C.

## Preparación 

1. Instalar el paquete de la placa Arduino Nano ESP32 en el IDE de Arduino.
2. Instalar las librerías mencionadas.
3. Conectar el módulo PN532 y el LED RGB según el esquema de conexiones.
4. Crear un archivo env.h basado en el siguiente ejemplo:

```
// env.example.h
#define WIFI_SSID     "ejemplo_ssid"
#define WIFI_PASSWORD "ejemplo_password"
#define API_URL       "https://ejemplo.com/api/nfc"
```

Hay un archivo con un ejemplo en la carpeta src. 

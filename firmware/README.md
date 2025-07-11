# firmware

Un artefacto que facilita la lectura de NFC sin un teléfono. 

## Requerimientos

Este proyecto usó: 

- Arduino nano con ESP32
- NFC lectura/escritura (este proyecto uso el rojo, no el azul)
- pila
- adicionales 

## Preparación 

Si es necesario: instalar el paquete de la placa en cuestión. Para este caso: Arduino Nano ESP32. 

Instalar wifi arduino con el gestor de librerías. 

También es necesaria la siguiente librería: 

https://github.com/elechouse/PN532

Por el LED RGB del Arduino Nano es posible que este código no funcione en otras placas. Revisar cambios. 

## Puesta en marcha

El archivo [firmware.ino](firmware.ino) requiere de un archivo env.h con las siguientes características: 

```
// env.example.h
#define WIFI_SSID     "ejemplo_ssid"
#define WIFI_PASSWORD "ejemplo_password"
#define API_URL       "https://ejemplo.com/api/nfc"
```


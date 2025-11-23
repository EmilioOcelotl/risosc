# risosc server

Para correr el servidor

```
npm install
pm2 start app.js --name risosc
pm2 save
```

Para actualizar

``
pm2 restart risosc
``

## Backup

Para hacer un respaldo sencillo con cp y crontab: 

```
nano ~/backup_db.sh
```

Copiar db con rotación: 

```
#!/bin/bash

# Configuración
DB_FILE="/ruta/a/tu/base_de_datos.db"
BACKUP_DIR="/ruta/a/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="backup_db_${DATE}.db.gz"
MAX_BACKUPS=7  # Mantener solo los últimos 7 backups

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Crear backup comprimido
cp "$DB_FILE" "/tmp/temp_backup.db"
gzip -c "/tmp/temp_backup.db" > "$BACKUP_DIR/$BACKUP_NAME"
rm "/tmp/temp_backup.db"

# Rotación: eliminar backups antiguos
cd "$BACKUP_DIR"
ls -t backup_db_*.db.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

echo "Backup creado: $BACKUP_DIR/$BACKUP_NAME"
```

Luego con crontab: 

```
crontab -e
```

Algunas opciones de configuración: 

```
# Backup cada día a las 2 AM
0 2 * * * /home/tuusuario/backup_db.sh

# Backup cada hora (útil para desarrollo)
0 * * * * /home/tuusuario/backup_db.sh

# Backup los lunes a las 3 AM
0 3 * * 1 /home/tuusuario/backup_db.sh
```

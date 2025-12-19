# Usamos la misma versión de Node que en el otro servicio
FROM node:22-slim

# Directorio de trabajo
WORKDIR /usr/src/app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el código fuente
COPY . .

# El servicio acquire escucha en el puerto 3001
EXPOSE 3001

# Comando de inicio
CMD ["node", "index.js"]
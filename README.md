# MedGO ImgFlow

Convierte un export HTML de Notion en un paquete listo para subir a la web, en un solo arrastre:

1. **Lee** el `.zip` de Notion (o la carpeta descomprimida, o archivos sueltos). Si Notion envuelve el export en otro ZIP, también lo abre.
2. **Analiza** los HTML y las imágenes (`.png`, `.jpg`, `.jpeg`, `.webp`; GIF/SVG se copian tal cual).
3. **Reduce por peso** las imágenes que superan el objetivo (700 KB por defecto), manteniendo la proporción.
4. **Sube** cada imagen a Cloudinary (10 en paralelo, **sin el límite de 20** de imgto.xyz).
5. **Convierte** con exactamente la misma transformación que usa [imgto.xyz](https://github.com/cloudinary-community/imgto.xyz): `f_avif` + `q_auto:low`.
6. **Reescribe** los `src`/`href` de los HTML para que apunten a los nuevos archivos (respetando `%20` y demás codificación).
7. **Empaqueta** un ZIP con el mismo nombre, la misma estructura y los mismos nombres de archivo (solo cambia la extensión de las imágenes).

Al terminar borra las copias temporales de Cloudinary para no gastar almacenamiento.

El formato de salida es AVIF por defecto y se puede cambiar a WebP, JPG, JXL o PNG.

## Requisitos

- Node.js 20.9 o superior
- Una cuenta gratuita de [Cloudinary](https://cloudinary.com)

## Configuración

```bash
git clone https://github.com/BUSTxd/medgo-imgflow.git
cd medgo-imgflow
npm install
cp .env.example .env.local
```

Rellena `.env.local` con los datos de **Cloudinary → Settings → API Keys**:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="tu-cloud-name"
NEXT_PUBLIC_CLOUDINARY_API_KEY="tu-api-key"
CLOUDINARY_API_SECRET="tu-api-secret"
NEXT_PUBLIC_CLOUDINARY_UPLOADS_FOLDER="medgo-imgflow"
```

Luego:

```bash
npm run dev
```

y abre http://localhost:3000.

## Cómo funciona

Todo el procesamiento ocurre en el navegador. El servidor solo firma las subidas (`/api/sign`) y borra los archivos temporales (`/api/cleanup`); las imágenes viajan directo del navegador a Cloudinary.

| Archivo | Qué hace |
| --- | --- |
| `src/lib/pipeline.ts` | Orquesta las 7 etapas y emite el progreso a la UI |
| `src/lib/notion.ts` | Lectura de ZIP/carpetas, plan de renombres y reescritura del HTML |
| `src/lib/resize.ts` | Reducción por peso con búsqueda binaria de escala |
| `src/lib/cloudinary.ts` | Subida firmada (basada en imgto.xyz) |

## Créditos

La lógica de subida y conversión está basada en [imgto.xyz](https://github.com/cloudinary-community/imgto.xyz) de Cloudinary Community (licencia MIT).

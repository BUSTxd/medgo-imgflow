# MedGO ImgFlow

**Web:** https://bustxd.github.io/medgo-imgflow/

Convierte un export HTML de Notion en un paquete listo para subir a la web, en un solo arrastre:

1. **Lee** el `.zip` de Notion (o la carpeta descomprimida, o archivos sueltos). Si Notion envuelve el export en otro ZIP, también lo abre.
2. **Analiza** los HTML y las imágenes (`.png`, `.jpg`, `.jpeg`, `.webp`; GIF/SVG se copian tal cual).
3. **Reduce por peso** las imágenes que superan el objetivo (700 KB por defecto), manteniendo la proporción.
4. **Sube** cada imagen a Cloudinary (10 en paralelo, **sin el límite de 20** de imgto.xyz).
5. **Convierte** con exactamente la misma transformación que usa [imgto.xyz](https://github.com/cloudinary-community/imgto.xyz): `f_avif` + `q_auto:low`.
6. **Reescribe** los `src`/`href` de los HTML para que apunten a los nuevos archivos (respetando `%20` y demás codificación).
7. **Empaqueta** un ZIP con el mismo nombre, la misma estructura y los mismos nombres de archivo (solo cambia la extensión de las imágenes).

Cada copia temporal en Cloudinary se borra apenas se descarga su versión convertida, para no gastar almacenamiento.

El formato de salida es AVIF por defecto y se puede cambiar a WebP, JPG, JXL o PNG.

## Uso

1. Crea una cuenta gratuita en [Cloudinary](https://cloudinary.com).
2. Abre la web e ingresa tu **cloud name**, **API key** y **API secret** (Cloudinary → Settings → API Keys). La web prueba la conexión antes de guardarlas.
3. Arrastra tu export de Notion y descarga el ZIP final.

### ¿Dónde quedan mis credenciales?

Solo en tu navegador (`localStorage`, o `sessionStorage` si desmarcas "Recordar"). La web es 100% estática y no tiene servidor: la firma de cada subida se calcula en tu navegador y las imágenes van directo a Cloudinary. Puedes borrarlas cuando quieras con "Olvidar credenciales".

## Desarrollo local

Requiere Node.js 20.9 o superior.

```bash
git clone https://github.com/BUSTxd/medgo-imgflow.git
cd medgo-imgflow
npm install
npm run dev
```

Cada push a `main` se publica automáticamente en GitHub Pages (`.github/workflows/deploy.yml`).

| Archivo | Qué hace |
| --- | --- |
| `src/lib/pipeline.ts` | Orquesta las 7 etapas y emite el progreso a la UI |
| `src/lib/notion.ts` | Lectura de ZIP/carpetas, plan de renombres y reescritura del HTML |
| `src/lib/resize.ts` | Reducción por peso con búsqueda binaria de escala |
| `src/lib/cloudinary.ts` | Subida firmada en el navegador y borrado por token |
| `src/lib/credentials.ts` | Credenciales guardadas en el navegador |

## Créditos

La lógica de subida y conversión está basada en [imgto.xyz](https://github.com/cloudinary-community/imgto.xyz) de Cloudinary Community (licencia MIT).

import { v2 as cloudinary } from 'cloudinary';

const UPLOADS_FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOADS_FOLDER || 'medgo-imgflow';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  const { publicIds } = await request.json();

  if (!Array.isArray(publicIds)) {
    return Response.json({ error: 'publicIds inválido' }, { status: 400 });
  }

  // Solo se permite borrar lo que esta app subió.
  const ids = publicIds.filter(
    (id): id is string => typeof id === 'string' && id.startsWith(`${UPLOADS_FOLDER}/`)
  );

  try {
    // La Admin API acepta hasta 100 ids por llamada.
    for (let i = 0; i < ids.length; i += 100) {
      await cloudinary.api.delete_resources(ids.slice(i, i + 100));
    }
    return Response.json({ deleted: ids.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : (error as { error?: { message?: string } })?.error?.message || 'Error desconocido';
    return Response.json({ error: message }, { status: 500 });
  }
}

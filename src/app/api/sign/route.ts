import { v2 as cloudinary } from 'cloudinary';

const UPLOADS_FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOADS_FOLDER || 'medgo-imgflow';

export async function POST(request: Request) {
  const secret = process.env.CLOUDINARY_API_SECRET;

  if (!secret) {
    return Response.json({ error: 'Falta CLOUDINARY_API_SECRET en .env.local' }, { status: 500 });
  }

  const { timestamp } = await request.json();

  // Solo firmamos lo que el pipeline necesita: carpeta fija + timestamp.
  const signature = cloudinary.utils.api_sign_request(
    { folder: UPLOADS_FOLDER, timestamp: Number(timestamp) },
    secret
  );

  return Response.json({ signature });
}

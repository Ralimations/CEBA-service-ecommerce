import { connection } from 'next/server';
import { activeCategories } from '@/server/public-data';
import { errorResponse } from '@/server/http';

// Public provider-registration metadata. Customer signup and login never wait for it.
export async function GET() {
  await connection();
  try {
    return Response.json({ categories: await activeCategories() });
  } catch (error) {
    return errorResponse(error);
  }
}

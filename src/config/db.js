import mongoose from 'mongoose';

export async function connectToDatabase(mongoUri) {
  mongoose.set('strictQuery', true);
  return mongoose.connect(mongoUri);
}

export function disconnectFromDatabase() {
  return mongoose.disconnect();
}

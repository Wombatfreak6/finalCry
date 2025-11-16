import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomId: string;
  user1SocketId: string;
  user2SocketId: string;
  user1Name: string;
  user2Name: string;
  createdAt: Date;
  endedAt?: Date;
  duration?: number;
  reportedBy?: string[];
}

const RoomSchema = new Schema<IRoom>({
  roomId: { type: String, required: true, unique: true },
  user1SocketId: { type: String, required: true },
  user2SocketId: { type: String, required: true },
  user1Name: { type: String, required: true },
  user2Name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  duration: { type: Number },
  reportedBy: { type: [String], default: [] },
});

export const Room = mongoose.model<IRoom>('Room', RoomSchema);




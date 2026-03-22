"use client";

import { useParams } from "next/navigation";
import { BookingRoom } from "@/components/booking/BookingRoom";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <BookingRoom bookingId={id} redirectFreelancer />;
}

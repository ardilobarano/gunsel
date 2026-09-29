"use client";

import { useState } from "react";
import { formatDateTR, getTodayKey } from "@/lib/utils";

export default function TodayLabelContent() {
  const [today] = useState(() => formatDateTR(getTodayKey()));
  return <>{today}</>;
}

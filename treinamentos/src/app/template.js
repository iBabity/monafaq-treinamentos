"use client";

import { useEffect, useState } from "react";

export default function Template({ children }) {
  return (
    <div className="animate-page" style={{ width: "100%", minHeight: "100vh" }}>
      {children}
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { signContractAction } from "@/app/(dashboard)/property/contracts/actions";

export function SignaturePad({
  contractId,
  tenantName,
}: {
  contractId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [pending, start] = useTransition();

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let x = 0, y = 0;
    if ("touches" in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }
    return { x: x - rect.left, y: y - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
    setHasDrawn(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function endDraw() {
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function submit() {
    if (!hasDrawn) {
      toast.push("Please draw your signature first", "error");
      return;
    }
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    start(async () => {
      try {
        const result = await signContractAction(contractId, dataUrl);
        if (!result.ok) {
          toast.push(result.error, "error");
          return;
        }
        toast.push("Contract signed", "success");
        router.refresh();
      } catch (e) {
        toast.push("Signing failed", "error");
      }
    });
  }

  return (
    <div className="bg-surface border border-ink-200 rounded-lg p-5 space-y-3">
      <div>
        <p className="text-sm font-medium text-ink-700">Tenant signature</p>
        <p className="text-xs text-ink-500">
          Have {tenantName || "the tenant"} sign in the box below.
        </p>
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        className="border border-ink-300 rounded bg-surface w-full touch-none"
      />
      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending}>Sign & Finalize</Button>
        <Button variant="secondary" onClick={clear}>Clear</Button>
      </div>
    </div>
  );
}

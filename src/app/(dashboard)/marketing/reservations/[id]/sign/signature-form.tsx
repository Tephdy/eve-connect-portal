"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { signReservationContractAction } from "./sign-action";

export function SignatureForm({
  contractId,
  reservationId,
  completionPath,
}: {
  contractId: string;
  reservationId: string;
  completionPath: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#111318";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const c = canvasRef.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.setPointerCapture(e.pointerId);
    setDrawing(true);
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }
  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setDrawing(false);
  }
  function clear() {
    const c = canvasRef.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#111318";
    ctx.lineWidth = 2.2;
    setHasSignature(false);
    setError(null);
  }

  async function submit() {
    if (!hasSignature) {
      setError("Please draw a signature first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    const r = await signReservationContractAction({
      contract_id: contractId,
      reservation_id: reservationId,
      signature_data_url: dataUrl,
    });
    if (!r.ok) {
      setError(r.error);
      toast.push(r.error, "error");
      setSubmitting(false);
      return;
    }
    toast.push("Contract signed", "success");
    router.push(completionPath);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-ink-300 bg-white dark:border-white/[0.1] dark:bg-[#0b0c10]">
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full touch-none rounded-xl"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
      {error && (
        <p className="text-xs text-danger-700 dark:text-danger-500">{error}</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-ink-500 hover:text-ink-900"
        >
          Clear
        </button>
        <Button onClick={submit} loading={submitting} disabled={!hasSignature}>
          Sign &amp; submit
        </Button>
      </div>
    </div>
  );
}

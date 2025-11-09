import type { FC, FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  statusMessage?: string | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000";

const ReportForm: FC<Props> = ({ statusMessage }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported in this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setIsLocating(false);
        setMessage(null);
      },
      (err) => {
        setIsLocating(false);
        setMessage(err.message || "Unable to fetch location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStreamError("Webcam access is not supported on this device.");
      return;
    }

    let isMounted = true;

    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current
            .play()
            .catch(() =>
              setStreamError("Camera ready, press Capture when you see yourself.")
            );
        }
      } catch (error) {
        console.error("Webcam error:", error);
        setStreamError(
          "Unable to access webcam. Please allow camera permissions."
        );
      }
    };

    startStream();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (capturePreview) {
        URL.revokeObjectURL(capturePreview);
      }
    };
  }, [capturePreview]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      setMessage("Camera is not ready yet.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext("2d");

    if (!context) {
      setMessage("Unable to capture image from webcam.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setMessage("Failed to capture photo.");
          return;
        }
        const nextUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturePreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
        setMessage("Snapshot ready to submit.");
      },
      "image/jpeg",
      0.92
    );
  }, []);

  const clearCapture = () => {
    setCapturedBlob(null);
    setCapturePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) {
      setMessage("Please add a report title.");
      return;
    }

    if (!description.trim()) {
      setMessage("Please describe what you are reporting.");
      return;
    }

    if (!capturedBlob) {
      setMessage("Capture a photo with the webcam before submitting.");
      return;
    }

    if (!location) {
      setMessage("Waiting for your location. Try refreshing it.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("lat", location.lat.toString());
    formData.append("lon", location.lon.toString());
    formData.append("photo", capturedBlob, "report.jpg");

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Unable to save report.");
      }

      setMessage("Report submitted successfully. Thank you!");
      setTitle("");
      setDescription("");
      clearCapture();
      requestLocation();
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Something went wrong.";
      setMessage(errMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-white/20 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur">
        <h2 className="text-lg font-semibold">Create a live report</h2>
        <p className="text-sm text-slate-600">
          Capture a frame with your webcam, describe the issue, and we will store
          it with your location.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-800">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="e.g., Noise complaint near 5th Ave"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="Add details about what you are seeing or hearing."
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-100 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Live location</p>
              <p className="text-xs text-slate-600">
                {location
                  ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`
                  : "Waiting for GPS..."}
              </p>
            </div>
            <button
              type="button"
              onClick={requestLocation}
              disabled={isLocating}
              className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLocating ? "Locating..." : "Refresh"}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800">
              Webcam snapshot
            </label>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-black">
              <video
                ref={videoRef}
                className="h-56 w-full object-cover"
                autoPlay
                playsInline
                muted
              />
            </div>
            {capturePreview && (
              <div className="mt-2 overflow-hidden rounded-xl border border-emerald-200 bg-white">
                <img
                  src={capturePreview}
                  alt="Captured preview"
                  className="h-40 w-full object-cover"
                />
              </div>
            )}
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={capturePhoto}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
              >
                Capture photo
              </button>
              {capturePreview && (
                <button
                  type="button"
                  onClick={clearCapture}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Clear snapshot
                </button>
              )}
            </div>
            {streamError && (
              <p className="mt-1 text-xs text-red-500">{streamError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit report"}
          </button>
        </form>

        {message && <p className="mt-2 text-sm text-slate-700">{message}</p>}
        {statusMessage && (
          <p className="mt-1 text-xs text-slate-500">Map: {statusMessage}</p>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </>
  );
};

export default ReportForm;

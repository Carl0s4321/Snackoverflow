import type { FC, FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

type Props = {
  statusMessage?: string | null;
  onSubmitted?: () => void;
  onClose?: () => void;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000";

const ReportForm: FC<Props> = ({ statusMessage, onSubmitted, onClose }) => {
  const webcamRef = useRef<Webcam>(null);

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

  const capturePhoto = useCallback(() => {
    if (!webcamRef.current) {
      setMessage("Camera is not ready yet.");
      return;
    }

    const screenshot = webcamRef.current.getScreenshot();
    if (!screenshot) {
      setMessage("Failed to capture photo.");
      return;
    }

    const blob = (() => {
      const [meta, data] = screenshot.split(",");
      const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      const binary = atob(data);
      const len = binary.length;
      const buffer = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        buffer[i] = binary.charCodeAt(i);
      }
      return new Blob([buffer], { type: mime });
    })();

    setCapturedBlob(blob);
    setCapturePreview(screenshot);
    setMessage("Snapshot ready to submit.");
  }, []);

  const clearCapture = () => {
    setCapturedBlob(null);
    setCapturePreview(null);
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
      onSubmitted?.();
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
      <div className="relative rounded-2xl border border-white/20 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur">
        {onClose && (
          <button
            type="button"
            aria-label="Close report form"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
          >
            ×
          </button>
        )}
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
              <Webcam
                ref={webcamRef}
                className="h-56 w-full object-cover"
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                onUserMedia={() => setStreamError(null)}
                onUserMediaError={(error) =>
                  setStreamError(
                    typeof error === "string"
                      ? error
                      : error?.message ||
                          "Unable to access webcam. Please allow camera permissions."
                  )
                }
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

    </>
  );
};

export default ReportForm;

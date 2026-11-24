"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { TipLabel } from "@/components/Tip";
import { saveClockSettings } from "@/lib/staff-clock-actions";

/** Owner only: where the school is, how far from that point staff may clock in, and the day's times. */
export function ClockSettings({
  lat,
  lng,
  radius,
  lateAfter,
  closeAt,
}: {
  lat: number | null;
  lng: number | null;
  radius: number;
  lateAfter: string;
  closeAt: string | null;
}) {
  const [la, setLa] = useState(lat === null ? "" : String(lat));
  const [ln, setLn] = useState(lng === null ? "" : String(lng));
  const [note, setNote] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);

  const here = () => {
    setNote(null);
    if (!("geolocation" in navigator)) {
      setNote("This browser can't share your location.");
      return;
    }
    setFinding(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFinding(false);
        setLa(p.coords.latitude.toFixed(6));
        setLn(p.coords.longitude.toFixed(6));
        const acc = Math.round(p.coords.accuracy);
        setNote(
          acc > 50
            ? `Found, but only accurate to about ${acc} m. Step outside into the middle of the compound and try again for a better pin.`
            : `Found (accurate to about ${acc} m). Press Save to use it.`,
        );
      },
      (e) => {
        setFinding(false);
        setNote(
          e.code === e.PERMISSION_DENIED
            ? "Allow location for this site in your browser settings, then try again."
            : "Your device couldn't find its location. Turn on Location and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    );
  };

  const map = la && ln ? `https://www.google.com/maps?q=${la},${ln}` : null;

  return (
    <ActionForm action={saveClockSettings} className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-bold text-brand-navy">School location</p>
        <p className="text-sm text-[#4A5A70]">
          Stand in the middle of the school compound with your phone, then press
          the button. Staff can only clock in and out within the allowed
          distance of this point.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={here}
            disabled={finding}
            className="s-btn2"
          >
            {finding ? "Finding your location…" : "Use my current location"}
          </button>
          {map && (
            <a
              href={map}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold text-c1 underline underline-offset-2"
            >
              Check the pin on a map
            </a>
          )}
        </div>
        <p
          role="status"
          className="mt-1 text-sm font-semibold text-brand-slate empty:hidden"
        >
          {note}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cs-lat">
              Latitude
            </label>
            <input
              id="cs-lat"
              name="lat"
              inputMode="decimal"
              className="sk-input py-2"
              value={la}
              onChange={(e) => setLa(e.target.value)}
              placeholder="e.g. 6.4400"
            />
          </div>
          <div>
            <label className="label" htmlFor="cs-lng">
              Longitude
            </label>
            <input
              id="cs-lng"
              name="lng"
              inputMode="decimal"
              className="sk-input py-2"
              value={ln}
              onChange={(e) => setLn(e.target.value)}
              placeholder="e.g. 3.4700"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <TipLabel
            htmlFor="cs-radius"
            tip="How far from the school's pin staff may be when they clock in or out. Set it to just cover your compound. Phones are usually accurate to 10 to 50 metres."
          >
            Allowed distance (metres)
          </TipLabel>
          <input
            id="cs-radius"
            name="radius"
            type="number"
            min={30}
            max={1000}
            step={10}
            className="sk-input py-2"
            defaultValue={radius}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="cs-late">
            Staff are late after
          </label>
          <input
            id="cs-late"
            name="late_after"
            type="time"
            className="sk-input py-2"
            defaultValue={lateAfter}
            required
          />
        </div>
        <div>
          <TipLabel
            htmlFor="cs-close"
            tip="Anyone who clocks out before this time is shown as leaving early."
          >
            Closing time
          </TipLabel>
          <input
            id="cs-close"
            name="close_at"
            type="time"
            className="sk-input py-2"
            defaultValue={closeAt ?? ""}
          />
        </div>
      </div>
      <SubmitButton className="s-btn self-start">
        Save clock-in settings
      </SubmitButton>
    </ActionForm>
  );
}

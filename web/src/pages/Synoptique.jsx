import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Activity,
  Clock,
  Droplets,
  Egg,
  Fan,
  Power,
  RefreshCw,
  RotateCw,
  Sparkles,
  Thermometer,
  Zap,
} from 'lucide-react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import Card from '../components/Card';
import { useIncubator } from '../context/IncubatorContext';
import { useLiveData } from '../context/LiveDataContext';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';

function FanTile({ label, on }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/40 p-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)]">
        <Fan
          className={`h-4 w-4 motion-reduce:animate-none ${
            on
              ? "animate-[spin_2.2s_linear_infinite] text-[var(--color-accent)]"
              : "text-[var(--color-ink-faint)]"
          }`}
          strokeWidth={1.75}
        />
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="data-value mt-0.5 text-sm">{on ? "Marche" : "Arrêt"}</p>
      </div>
    </div>
  );
}

function IncubatorSvg({
  turning,
  hatching,
  inclineSide,
  temperature,
  humidite,
  pwmChauffage,
  compact = false,
}) {
  const eggs = [
    { x: 226, delay: 0 },
    { x: 277, delay: 0.12 },
    { x: 328, delay: 0.24 },
    { x: 379, delay: 0.36 },
    { x: 430, delay: 0.48 },
  ];

  return (
    <div className={`relative ${compact ? "w-full" : "h-full w-full"}`}>
      <style>{`
        /* Animation fluide de transition lors de l'action, puis l'oeuf reste incliné */
        @keyframes egg-tilt-transition {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(calc(var(--target-angle) * 0.5deg)); }
          100% { transform: translateY(-2px) rotate(calc(var(--target-angle) * 1deg)); }
        }
        @keyframes egg-hatching-motion {
          0%, 15% { transform: translate(0, 0) rotate(0deg) scale(1); }
          22% { transform: translate(-2px, -2px) rotate(-4deg) scale(1.02); }
          28% { transform: translate(2px, -1px) rotate(4deg) scale(1.03); }
          35% { transform: translate(-3px, -4px) rotate(-6deg) scale(1.05); }
          42% { transform: translate(3px, -3px) rotate(5deg) scale(1.06); }
          50%, 100% { transform: translate(0, -6px) rotate(0deg) scale(1.08); }
        }
        @keyframes shell-crack-draw {
          0%, 35% { stroke-dashoffset: 80; opacity: 0; }
          45% { opacity: 1; }
          60% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes shell-top-fly {
          0%, 45% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          50% { opacity: 1; }
          70% { transform: translate(-8px, -18px) rotate(-28deg); opacity: 1; }
          100% { transform: translate(-12px, -14px) rotate(-22deg); opacity: 1; }
        }
        @keyframes fragment-left-fly {
          0%, 45% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          65% { transform: translate(-18px, -10px) rotate(-45deg); opacity: 1; }
          100% { transform: translate(-24px, -6deg) rotate(-65deg); opacity: 1; }
        }
        @keyframes fragment-right-fly {
          0%, 45% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          65% { transform: translate(18px, -8px) rotate(42deg); opacity: 1; }
          100% { transform: translate(24px, -4deg) rotate(60deg); opacity: 1; }
        }
        @keyframes chick-emerge {
          0%, 45% { transform: translateY(22px) scale(0.2); opacity: 0; }
          60% { transform: translateY(2px) scale(0.9); opacity: 1; }
          75% { transform: translateY(-6px) scale(1.08); opacity: 1; }
          100% { transform: translateY(-4px) scale(1); opacity: 1; }
        }
        @keyframes chick-look {
          0%, 65% { transform: rotate(0deg); }
          75% { transform: rotate(-8deg); }
          85% { transform: rotate(8deg); }
          100% { transform: rotate(0deg); }
        }

        .egg-group {
          transform-box: fill-box;
          transform-origin: center bottom;
          transition: transform 1.2s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .egg-group.is-turning {
          animation: egg-tilt-transition 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          animation-delay: var(--egg-delay);
        }
        .egg-group.is-hatching {
          animation: egg-hatching-motion 3.6s cubic-bezier(0.25, 1, 0.5, 1) both;
          animation-delay: var(--egg-delay);
        }
        .shell-crack {
          stroke-dasharray: 80;
          animation: shell-crack-draw 3.6s cubic-bezier(0.25, 1, 0.5, 1) both;
          animation-delay: var(--egg-delay);
        }
        .shell-top {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: shell-top-fly 3.6s cubic-bezier(0.25, 1, 0.5, 1) both;
          animation-delay: var(--egg-delay);
        }
        .frag-left {
          transform-box: fill-box;
          transform-origin: center;
          animation: fragment-left-fly 3.6s cubic-bezier(0.25, 1, 0.5, 1) both;
          animation-delay: var(--egg-delay);
        }
        .frag-right {
          transform-box: fill-box;
          transform-origin: center;
          animation: fragment-right-fly 3.6s cubic-bezier(0.25, 1, 0.5, 1) both;
          animation-delay: var(--egg-delay);
        }
        .chick-container {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: chick-emerge 3.6s cubic-bezier(0.25, 1, 0.5, 1) both;
          animation-delay: var(--chick-delay);
        }
        .chick-head {
          transform-box: fill-box;
          transform-origin: center 60%;
          animation: chick-look 3.6s ease-in-out infinite;
          animation-delay: calc(var(--chick-delay) + 1.2s);
        }

        @media (prefers-reduced-motion: reduce) {
          .egg-group,
          .egg-group.is-turning,
          .egg-group.is-hatching,
          .shell-crack,
          .shell-top,
          .frag-left,
          .frag-right,
          .chick-container,
          .chick-head {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <svg
        viewBox="0 0 680 410"
        className="h-auto w-full drop-shadow-xl"
        role="img"
        aria-labelledby="incubator-svg-title incubator-svg-description"
      >
        <title id="incubator-svg-title">
          Vue 3D de l'incubateur avec inclinaison des oeufs
        </title>
        <desc id="incubator-svg-description">
          Plateau d'oeufs avec position d'inclinaison stable entre les
          basculements.
        </desc>

        <defs>
          <linearGradient id="incubatorShell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f8fafc" />
            <stop offset="0.52" stopColor="#e2e8f0" />
            <stop offset="1" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="incubatorSide" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#cbd5e1" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="glassPanel" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#e0f2fe" stopOpacity="0.88" />
            <stop offset="0.5" stopColor="#bae6fd" stopOpacity="0.35" />
            <stop offset="1" stopColor="#334155" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="eggShellGrad" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#fffbeb" />
            <stop offset="0.45" stopColor="#fde68a" />
            <stop offset="0.85" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="eggHighlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="warmGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0.38" />
            <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="10"
              floodColor="#0f172a"
              floodOpacity="0.2"
            />
          </filter>
          <filter id="eggShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="1"
              dy="6"
              stdDeviation="4"
              floodColor="#0f172a"
              floodOpacity="0.25"
            />
          </filter>
          <marker
            id="airArrow"
            markerWidth="6"
            markerHeight="6"
            refX="4"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" opacity="0.8" />
          </marker>
        </defs>

        { }
        <ellipse
          cx="340"
          cy="376"
          rx="234"
          ry="18"
          fill="#0f172a"
          opacity="0.15"
        />
        <ellipse cx="340" cy="245" rx="250" ry="135" fill="url(#warmGlow)" />

        { }
        <g filter="url(#softShadow)">
          <path
            d="M112 76 L174 40 L566 40 L628 76 L566 112 L174 112 Z"
            fill="url(#incubatorShell)"
            stroke="#94a3b8"
            strokeWidth="2"
          />
          <path
            d="M628 76 L628 307 L566 344 L566 112 Z"
            fill="url(#incubatorSide)"
            stroke="#94a3b8"
            strokeWidth="2"
          />
          <rect
            x="112"
            y="76"
            width="454"
            height="231"
            rx="24"
            fill="url(#incubatorShell)"
            stroke="#94a3b8"
            strokeWidth="2"
          />
        </g>

        { }
        <rect
          x="139"
          y="102"
          width="400"
          height="167"
          rx="18"
          fill="#0f172a"
          opacity="0.15"
        />
        <rect
          x="139"
          y="96"
          width="400"
          height="167"
          rx="18"
          fill="url(#glassPanel)"
          stroke="#ffffff"
          strokeOpacity="0.8"
          strokeWidth="2"
        />
        <path
          d="M162 108 C250 80, 398 88, 508 108"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.75"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M180 248 C270 262, 400 260, 500 238"
          fill="none"
          stroke="#64748b"
          strokeOpacity="0.25"
          strokeWidth="2"
        />

        { }
        <path
          d="M176 183 C202 161, 218 161, 238 177"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.65"
          strokeWidth="2"
          strokeDasharray="5 6"
          markerEnd="url(#airArrow)"
        />
        <path
          d="M504 183 C478 161, 462 161, 442 177"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.65"
          strokeWidth="2"
          strokeDasharray="5 6"
          markerEnd="url(#airArrow)"
        />

        { }
        <path
          d="M184 226 L236 203 L444 203 L496 226 L444 250 L236 250 Z"
          fill="#475569"
          opacity="0.5"
          stroke="#334155"
          strokeWidth="2"
        />
        <path
          d="M184 226 L184 246 L236 273 L444 273 L496 246 L496 226 L444 250 L236 250 Z"
          fill="#334155"
          opacity="0.45"
        />
        <path
          d="M205 229 L247 211 L433 211 L475 229 L433 243 L247 243 Z"
          fill="#1e293b"
          opacity="0.7"
        />

        { }
        {eggs.map(({ x, delay }, index) => (
          <g key={x} transform={`translate(${x} 207)`}>
            { }
            <ellipse
              className="egg-shadow"
              cx={inclineSide === "right" ? 3 : inclineSide === "left" ? -3 : 0}
              cy="25"
              rx="20"
              ry="5.5"
              fill="#0f172a"
              opacity="0.26"
            />

            <g
              className={`egg-group ${turning ? "is-turning" : ""} ${hatching ? "is-hatching" : ""}`}
              style={{
                "--egg-delay": `${delay}s`,
                "--target-angle":
                  inclineSide === "right"
                    ? 22
                    : inclineSide === "left"
                      ? -22
                      : 0,
                transform:
                  !turning && !hatching
                    ? `rotate(${inclineSide === "right" ? 22 : inclineSide === "left" ? -22 : 0}deg)`
                    : undefined,
              }}
              filter="url(#eggShadow)"
            >
              { }
              <path
                d="M0 -42 C-18 -42 -26 -23 -25 -5 C-24 14 -13 29 0 29 C13 29 24 14 25 -5 C26 -23 18 -42 0 -42 Z"
                fill="url(#eggShellGrad)"
                stroke="#b45309"
                strokeWidth="1.2"
              />
              { }
              <path
                d="M-10 -30 C-4 -38 4 -38 9 -28 C4 -31 -3 -30 -10 -30 Z"
                fill="url(#eggHighlight)"
              />

              { }
              {hatching && (
                <>
                  <path
                    className="shell-crack"
                    style={{ "--egg-delay": `${delay}s` }}
                    d="M-16 -8 L-10 -12 L-6 -2 L0 -11 L6 -3 L10 -13 L16 -7 M0 -11 L-3 -19 M6 -3 L11 4"
                    fill="none"
                    stroke="#78350f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    className="shell-top"
                    style={{ "--egg-delay": `${delay}s` }}
                    d="M-15 -8 C-13 -26 -7 -40 0 -41 C7 -40 13 -26 15 -8 L9 -11 L4 -6 L0 -12 L-6 -6 L-10 -11 Z"
                    fill="#fde68a"
                    stroke="#b45309"
                    strokeWidth="1.2"
                  />
                  <path
                    className="frag-left"
                    style={{ "--egg-delay": `${delay}s` }}
                    d="M-12 -6 L-20 -11 L-16 -18 L-8 -12 Z"
                    fill="#fcd34d"
                    stroke="#b45309"
                    strokeWidth="0.8"
                  />
                  <path
                    className="frag-right"
                    style={{ "--egg-delay": `${delay}s` }}
                    d="M12 -6 L20 -10 L16 -17 L8 -12 Z"
                    fill="#fcd34d"
                    stroke="#b45309"
                    strokeWidth="0.8"
                  />

                  <g
                    className="chick-container"
                    style={{ "--chick-delay": `${delay}s` }}
                  >
                    <g className="chick-head">
                      <ellipse
                        cx="0"
                        cy="-44"
                        rx="13.5"
                        ry="14.5"
                        fill="#facc15"
                        stroke="#ca8a04"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M-12 -42 Q-17 -37 -13 -32 M12 -42 Q17 -37 13 -32"
                        fill="none"
                        stroke="#eab308"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <circle cx="-4.5" cy="-48" r="1.6" fill="#1e293b" />
                      <circle cx="4.5" cy="-48" r="1.6" fill="#1e293b" />
                      <circle cx="-4" cy="-48.5" r="0.6" fill="#ffffff" />
                      <circle cx="5" cy="-48.5" r="0.6" fill="#ffffff" />
                      <path
                        d="M-3.5 -43 L0 -38 L3.5 -43 Z"
                        fill="#f97316"
                        stroke="#c2410c"
                        strokeWidth="0.5"
                      />
                      <path
                        d="M-6 -59 Q0 -66 6 -59"
                        fill="none"
                        stroke="#ca8a04"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                </>
              )}
            </g>
          </g>
        ))}

        { }
        <path
          d="M222 294 C278 307, 402 307, 458 294"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M223 294 C278 307, 402 307, 457 294"
          fill="none"
          stroke="#fff7ed"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="174" cy="131" r="5" fill="#22c55e" />
        <circle cx="194" cy="131" r="5" fill="#38bdf8" />

        { }
        <path d="M150 288 H528" stroke="#94a3b8" strokeWidth="2" />
        <rect
          x="268"
          y="285"
          width="144"
          height="34"
          rx="10"
          fill="#0f172a"
          opacity="0.9"
        />
        <text
          x="340"
          y="299"
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          letterSpacing="1.2"
          fill="#fbbf24"
        >
          SMART INCUBATOR
        </text>
        <text x="340" y="312" textAnchor="middle" fontSize="7" fill="#cbd5e1">
          SYSTÈME ACTIF
        </text>

        { }
        <g transform="translate(154 330)">
          <rect
            width="104"
            height="28"
            rx="9"
            fill="#ffffff"
            fillOpacity="0.8"
            stroke="#cbd5e1"
          />
          <text x="12" y="12" fontSize="7" fill="#64748b" fontWeight="600">
            TEMPÉRATURE
          </text>
          <text x="12" y="23" fontSize="11" fontWeight="700" fill="#0f172a">
            {temperature}°C
          </text>
        </g>
        <g transform="translate(286 330)">
          <rect
            width="104"
            height="28"
            rx="9"
            fill="#ffffff"
            fillOpacity="0.8"
            stroke="#cbd5e1"
          />
          <text x="12" y="12" fontSize="7" fill="#64748b" fontWeight="600">
            HUMIDITÉ
          </text>
          <text x="12" y="23" fontSize="11" fontWeight="700" fill="#0f172a">
            {humidite}%
          </text>
        </g>
        <g transform="translate(418 330)">
          <rect
            width="104"
            height="28"
            rx="9"
            fill="#ffffff"
            fillOpacity="0.8"
            stroke="#cbd5e1"
          />
          <text x="12" y="12" fontSize="7" fill="#64748b" fontWeight="600">
            CHAUFFAGE
          </text>
          <text x="12" y="23" fontSize="11" fontWeight="700" fill="#0f172a">
            {pwmChauffage}%
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function Synoptique() {
  const location = useLocation();
  const navigate = useNavigate();
  const { dernierMessage } = useLiveData();
  const { selectedIncubatorId } = useIncubator();
  const { execute } = useApi();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [isTurning, setIsTurning] = useState(false);
  const [isHatching, setIsHatching] = useState(false);
  const [inclineSide, setInclineSide] = useState("right");
  const [actionMessage, setActionMessage] = useState(null);
  const lastTriggeredFor = useRef(null);
  const actionTimer = useRef(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!selectedIncubatorId) {
        setLoading(false);
        return;
      }
      try {
        const data = await execute(() =>
          apiClient.getIncubator(selectedIncubatorId),
        );
        setStatus(data || null);
      } catch (err) {
        console.error("Erreur chargement statut:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [selectedIncubatorId]);

  useEffect(() => {
    if (dernierMessage && dernierMessage.data) {
      setStatus((prev) => ({ ...prev, ...dernierMessage.data }));
    }
  }, [dernierMessage]);

  const d = status || {};

  useEffect(() => () => clearTimeout(actionTimer.current), []);

  const runAnimation = (type) => {
    clearTimeout(actionTimer.current);
    if (type === "turn") {
      setActionMessage("Inclinaison des oeufs lancée");
      setIsTurning(true);
      setInclineSide((prev) => (prev === "right" ? "left" : "right"));
    } else {
      setActionMessage("Éclosion anticipée lancée");
      setIsHatching(true);
    }

    actionTimer.current = setTimeout(
      () => {
        if (type === "turn") setIsTurning(false);
        if (type === "hatch") setIsHatching(false);
        setActionMessage(null);
      },
      type === "turn" ? 1400 : 3600,
    );
  };

  const callOptionalApiAction = async (names) => {
    const method = names
      .map((name) => apiClient?.[name])
      .find((candidate) => typeof candidate === "function");
    if (method) await execute(method);
  };

  const handleManualTurn = async () => {
    if (isTurning || isHatching || !selectedIncubatorId) return;
    runAnimation("turn");
    try {
      await execute(() =>
        apiClient.postIncubatorMotorCommand(selectedIncubatorId, {
          action: "start",
        }),
      );
    } catch (error) {
      console.error("Erreur inclinaison manuelle:", error);
      setActionMessage("Animation locale : commande API indisponible");
    }
  };

  const handleEarlyHatch = async () => {
    if (isTurning || isHatching) return;
    runAnimation("hatch");
    try {
      await callOptionalApiAction([
        "earlyHatch",
        "hatchEggs",
        "eclosion",
        "ecloreOeufs",
      ]);
    } catch (error) {
      console.error("Erreur éclosion anticipée:", error);
      setActionMessage("Animation locale : commande API indisponible");
    }
  };

  useEffect(() => {
    if (location.state?.playHatching) {
      runAnimation("hatch");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!d.prochain_retournement) {
      setCountdown(null);
      return;
    }

    const target = new Date(d.prochain_retournement).getTime();
    const tick = () => {
      const diff = target - Date.now();

      if (diff <= 0) {
        setCountdown({ text: "00:00:00", label: "Inclinaison en cours" });
        if (lastTriggeredFor.current !== d.prochain_retournement) {
          lastTriggeredFor.current = d.prochain_retournement;
          runAnimation("turn");
        }
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, "0");
      setCountdown({
        text: `${pad(h)}:${pad(m)}:${pad(s)}`,
        label: `Dans ${h}h ${m}m ${s}s`,
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [d.prochain_retournement]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw
          className="h-5 w-5 animate-spin text-[var(--color-ink-soft)]"
          strokeWidth={1.75}
        />
      </div>
    );
  }

  const temperature = d.temperature?.toFixed(1) ?? "0";
  const humidite = d.humidite?.toFixed(1) ?? "0";
  const pwmChauffage = d.pwm_chauffage ?? "0";
  const brassageOn = d.etat_ventilateur_brassage === "on";
  const extractionOn = d.etat_ventilateur_extraction === "on";
  const pompeOn = d.etat_pompe === "on";
  const eauOk = (d.niveau_eau ?? "ok") === "ok";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            <Activity className="h-3.5 w-3.5" />
            Centre de contrôle
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            Synoptique de l'incubateur
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Une vue 3D claire de votre environnement, en temps réel.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 self-start md:items-end md:self-auto">
          <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 ${
              isTurning || isHatching
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-line)] bg-[var(--color-surface)]"
            }`}
          >
            <Clock
              className={`h-4 w-4 ${isTurning ? "animate-pulse text-[var(--color-accent)]" : "text-[var(--color-ink-soft)]"}`}
              strokeWidth={1.75}
            />
            <span className="data-value text-sm">
              {isHatching
                ? "Éclosion en cours…"
                : isTurning
                  ? "Inclinaison en cours…"
                  : countdown
                    ? `Inclinaison dans ${countdown.text}`
                    : "Inclinaison non programmée"}
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleManualTurn}
              disabled={isTurning || isHatching || !selectedIncubatorId}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCw
                className={
                  isTurning ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"
                }
              />{" "}
              Incliner
            </button>
            <button
              type="button"
              onClick={handleEarlyHatch}
              disabled={isTurning || isHatching}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Egg className="h-3.5 w-3.5" /> Éclore maintenant
            </button>
          </div>
          {actionMessage && (
            <p className="text-right text-xs text-[var(--color-ink-soft)]">
              <Sparkles className="mr-1 inline h-3 w-3" />
              {actionMessage}
            </p>
          )}
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Chambre d'incubation
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                {isHatching
                  ? "Animation SVG réaliste de l'éclosion des œufs"
                  : "Animation SVG 3D de l'inclinaison stable"}
              </p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-[var(--color-ink-soft)] sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
              Système actif
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-line)] bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface)] p-2 sm:p-4">
            <IncubatorSvg
              turning={isTurning}
              hatching={isHatching}
              inclineSide={inclineSide}
              temperature={temperature}
              humidite={humidite}
              pwmChauffage={pwmChauffage}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-line)] p-3">
              <div className="mb-1 flex items-center gap-2">
                <Thermometer
                  className="h-3.5 w-3.5 text-[var(--color-ink-soft)]"
                  strokeWidth={1.75}
                />
                <p className="stat-label">Température</p>
              </div>
              <p className="data-value text-lg">{temperature}°C</p>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] p-3">
              <div className="mb-1 flex items-center gap-2">
                <Droplets
                  className="h-3.5 w-3.5 text-[var(--color-ink-soft)]"
                  strokeWidth={1.75}
                />
                <p className="stat-label">Humidité</p>
              </div>
              <p className="data-value text-lg">{humidite}%</p>
            </div>
            <FanTile label="Brassage" on={brassageOn} />
            <FanTile label="Extraction" on={extractionOn} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] p-3">
              <Power
                className={`h-4 w-4 flex-shrink-0 ${pompeOn ? "text-[var(--color-ok)]" : "text-[var(--color-ink-soft)]"}`}
                strokeWidth={1.75}
              />
              <div>
                <p className="stat-label">Pompe</p>
                <p className="data-value mt-0.5 text-sm">
                  {pompeOn ? "Marche" : "Arrêt"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] p-3">
              <Zap
                className="h-4 w-4 flex-shrink-0 text-[var(--color-warn)]"
                strokeWidth={1.75}
              />
              <div>
                <p className="stat-label">Chauffage</p>
                <p className="data-value mt-0.5 text-sm">{pwmChauffage}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] p-3">
              <div className="flex h-6 w-3 items-end overflow-hidden rounded-sm border border-[var(--color-line-strong)]">
                <div
                  className={`w-full ${eauOk ? "h-3/4 bg-[var(--color-ok)]" : "h-1/4 bg-[var(--color-crit)]"}`}
                />
              </div>
              <div>
                <p className="stat-label">Niveau d'eau</p>
                <p className="data-value mt-0.5 text-sm">
                  {eauOk ? "OK" : "Bas"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] p-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${isTurning ? "animate-ping bg-amber-400" : "bg-emerald-500"}`}
              />
              <div>
                <p className="stat-label">Plateau</p>
                <p className="data-value mt-0.5 text-sm">
                  {isTurning ? "En inclinaison" : "Stable"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

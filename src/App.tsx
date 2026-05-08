import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Cpu, Download, Play, RefreshCcw, Sparkles, Thermometer, Wind, Zap } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  ComposedChart,
  Legend
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';

const MATERIALS = {
  Silicon: {
    Eg0: 1.17,
    alpha: 4.73e-4,
    beta: 636,
    massRatio: 0.56 / 1.08,
    muE300: 1450,
    muH300: 450,
    Nc300: 2.8e19,
    Nv300: 1.04e19
  },
  Germanium: {
    Eg0: 0.743,
    alpha: 4.7e-4,
    beta: 235,
    massRatio: 0.37 / 0.55,
    muE300: 3900,
    muH300: 1800,
    Nc300: 1.4e19,
    Nv300: 4.0e18
  },
  GaAs: {
    Eg0: 1.519,
    alpha: 5.4e-4,
    beta: 204,
    massRatio: 0.48 / 0.067,
    muE300: 8500,
    muH300: 400,
    Nc300: 4.7e17,
    Nv300: 7.0e18
  },
  GaN: {
    Eg0: 3.4,
    alpha: 9.7e-4,
    beta: 830,
    massRatio: 0.8 / 0.2,
    muE300: 1000,
    muH300: 200,
    Nc300: 2.3e18,
    Nv300: 8.5e18
  },
  SiC: {
    Eg0: 3.26,
    alpha: 4.5e-4,
    beta: 900,
    massRatio: 0.8 / 0.42,
    muE300: 800,
    muH300: 120,
    Nc300: 1.8e18,
    Nv300: 4.5e18
  }
};

const kB = 8.617333262145e-5;
const q = 1.602176634e-19;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function formatSci(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '0';
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  return `${mantissa.toFixed(digits)}×10^${exponent}`;
}

function computeSemiconductor(materialKey: keyof typeof MATERIALS, T: number) {
  const material = MATERIALS[materialKey];
  const Eg = material.Eg0 - (material.alpha * T * T) / (T + material.beta);
  const Nc = material.Nc300 * Math.pow(T / 300, 1.5);
  const Nv = material.Nv300 * Math.pow(T / 300, 1.5);
  const ni = Math.sqrt(Nc * Nv) * Math.exp(-Eg / (2 * kB * T));
  const muE = material.muE300 * Math.pow(T / 300, -2.24);
  const muH = material.muH300 * Math.pow(T / 300, -2.20);
  const Ec = Eg / 2;
  const Ev = -Eg / 2;
  const Ef = (Ec + Ev) / 2 + 0.75 * kB * T * Math.log(material.massRatio);
  const activationEnergy = Eg / 2;
  const intrinsicConductivity = q * ni * (muE + muH);
  return { Eg, Nc, Nv, ni, muE, muH, Ec, Ev, Ef, activationEnergy, intrinsicConductivity };
}

function buildGraphData(material: keyof typeof MATERIALS) {
  return Array.from({ length: 76 }, (_, index) => {
    const T = 250 + index * 10;
    const result = computeSemiconductor(material, T);
    return {
      T,
      Eg: result.Eg,
      ni: result.ni,
      sigma: result.intrinsicConductivity,
      logSigma: Math.log(Math.max(result.intrinsicConductivity, 1e-24)),
      invT: 1 / T,
      muE: result.muE,
      muH: result.muH,
      activationEnergy: result.activationEnergy
    };
  });
}

const DEFAULT_TEMPERATURE = 300;

export default function App() {
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [material, setMaterial] = useState<keyof typeof MATERIALS>('Silicon');
  const [dopingType, setDopingType] = useState<'intrinsic' | 'n-type' | 'p-type'>('intrinsic');
  const [dopingConcentration, setDopingConcentration] = useState(1e16);
  const [autoMode, setAutoMode] = useState(false);

  useEffect(() => {
    if (!autoMode) return undefined;
    const interval = window.setInterval(() => {
      setTemperature((current) => {
        if (current >= 1000) return 250;
        return clamp(current + 2, 250, 1000);
      });
    }, 120);
    return () => window.clearInterval(interval);
  }, [autoMode]);

  const simulation = useMemo(() => computeSemiconductor(material, temperature), [material, temperature]);

  const dopingResults = useMemo(() => {
    const ni = simulation.ni;
    if (dopingType === 'intrinsic') {
      return {
        n: ni,
        p: ni,
        conductivity: simulation.intrinsicConductivity,
        majority: 'Intrinsic carriers'
      };
    }
    const dopant = dopingConcentration;
    if (dopingType === 'n-type') {
      const n = Math.max(dopant, ni);
      const p = Math.max(ni * ni / n, 1);
      return {
        n,
        p,
        conductivity: q * (n * simulation.muE + p * simulation.muH),
        majority: 'Electron-dominated (n-type)'
      };
    }
    const p = Math.max(dopant, ni);
    const n = Math.max(ni * ni / p, 1);
    return {
      n,
      p,
      conductivity: q * (n * simulation.muE + p * simulation.muH),
      majority: 'Hole-dominated (p-type)'
    };
  }, [dopingType, dopingConcentration, simulation]);

  const graphData = useMemo(() => buildGraphData(material), [material]);

  const insights = useMemo(() => {
    const items = [] as string[];
    const percentChangeEg = ((simulation.Eg - MATERIALS[material].Eg0) / MATERIALS[material].Eg0) * 100;
    if (temperature > 700) {
      items.push('Intrinsic region dominates above 700 K, leading to exponential conductivity growth.');
    }
    if (Math.abs(percentChangeEg) > 5) {
      items.push(`Bandgap reduced by ${Math.abs(percentChangeEg).toFixed(1)}% from the zero-K reference.`);
    }
    if (temperature > 500) {
      items.push('Carrier generation surpasses mobility degradation, so conductivity rises strongly.');
    }
    if (dopingType !== 'intrinsic') {
      items.push(`Doping shifts the Fermi level and alters the majority carrier population for ${dopingType}.`);
    }
    if (temperature < 330) {
      items.push('Low temperature preserves a wide bandgap, keeping intrinsic conductivity small.');
    }
    return items;
  }, [material, temperature, dopingType]);

  const temperaturePercent = ((temperature - 250) / 750) * 100;
  const sliderGradient = `linear-gradient(90deg, #7c3aed ${temperaturePercent}%, rgba(100, 116, 139, 0.18) ${temperaturePercent}%)`;

  const exportCSV = () => {
    const csvRows = [
      ['Temperature (K)', 'Eg (eV)', 'ni (cm^-3)', 'σ (S/cm)', 'μe (cm^2/Vs)', 'μh (cm^2/Vs)'],
      ...graphData.map((point) => [
        point.T,
        point.Eg.toFixed(4),
        point.ni.toExponential(4),
        point.sigma.toExponential(4),
        point.muE.toFixed(1),
        point.muH.toFixed(1)
      ])
    ];
    const csvString = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'semiconductor-simulation-data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen px-4 py-6 text-slate-100 scrollbar-thin sm:px-6 lg:px-10">
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-grid-glow"></div>
      <div className="relative z-10 space-y-6">
        <header className="glass-panel neon-border p-6 rounded-3xl border border-white/10 shadow-glow overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-fuchsia-500/10 to-transparent blur-3xl"></div>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-sm text-sky-100 ring-1 ring-slate-400/10">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Semiconductor Conductivity Simulator
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Temperature Dependence of Intrinsic Silicon Conductivity & Fermi Level Analysis</h1>
                <p className="mt-2 max-w-2xl text-slate-300">A research-grade dashboard for semiconductor labs with live band structure visualization, thermal dynamics, and advanced material comparison.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="glass-panel rounded-3xl border border-white/10 p-4 shadow-glow">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Live Temperature</p>
                <p className="mt-3 text-4xl font-semibold text-cyan-300">{temperature.toFixed(0)} K</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600" style={{ width: `${temperaturePercent}%` }} />
                </div>
              </div>
              <div className="glass-panel rounded-3xl border border-white/10 p-4 shadow-glow">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Simulation Status</p>
                <p className="mt-3 text-2xl font-semibold text-emerald-300">{autoMode ? 'Auto mode active' : 'Manual control'}</p>
                <p className="mt-2 text-slate-300">{autoMode ? 'Thermal ramp is animating the semiconductor response.' : 'Use sliders or controls to explore temperature effects.'}</p>
              </div>
              <div className="glass-panel rounded-3xl border border-white/10 p-4 shadow-glow">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Thermal Indicator</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="rounded-full bg-gradient-to-br from-fuchsia-500/40 to-sky-400/20 p-3 text-fuchsia-300 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                    <Thermometer className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{temperature > 700 ? 'Thermal surge' : temperature > 450 ? 'Warm regime' : 'Cool regime'}</p>
                    <p className="text-sm text-slate-300">{temperature > 700 ? 'Carrier generation expands.' : temperature > 450 ? 'Bandgap narrowing begins.' : 'Quantum limit remains high.'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
          <section className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Temperature Controls</h2>
                <p className="mt-1 text-sm text-slate-400">Precise thermal tuning for intrinsic silicon and advanced materials.</p>
              </div>
              <div className="rounded-full bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.24em] text-sky-300">Lab Mode</div>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4 shadow-inner">
                <label className="block text-sm font-medium text-slate-300">Temperature slider</label>
                <input
                  type="range"
                  min="250"
                  max="1000"
                  value={temperature}
                  style={{ background: sliderGradient }}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  className="mt-3 w-full accent-cyan-400"
                />
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>250 K</span>
                  <span>1000 K</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4 text-slate-300">
                  Numeric input
                  <input
                    type="number"
                    min={250}
                    max={1000}
                    value={temperature}
                    onChange={(event) => setTemperature(clamp(Number(event.target.value), 250, 1000))}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  />
                </label>
                <label className="flex flex-col gap-2 rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4 text-slate-300">
                  Material
                  <select
                    value={material}
                    onChange={(event) => setMaterial(event.target.value as keyof typeof MATERIALS)}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-fuchsia-400"
                  >
                    {Object.keys(MATERIALS).map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setTemperature((current) => clamp(current + 20, 250, 1000))}
                  className="group relative inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-glow transition hover:-translate-y-0.5"
                >
                  <ArrowUpRight className="mr-2 h-4 w-4 text-slate-950" /> Heat Up
                </button>
                <button
                  onClick={() => setTemperature((current) => clamp(current - 20, 250, 1000))}
                  className="group relative inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-glow transition hover:-translate-y-0.5"
                >
                  <ArrowDownRight className="mr-2 h-4 w-4 text-slate-950" /> Cool Down
                </button>
              </div>
              <div className="rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Auto Simulation</p>
                    <p className="text-xs text-slate-500">Gradually ramp temperature in lab mode.</p>
                  </div>
                  <button
                    onClick={() => setAutoMode((current) => !current)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${autoMode ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                  >
                    <Play className="h-4 w-4" /> {autoMode ? 'Pause' : 'Start'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
              <p className="text-sm font-medium text-slate-300">Doping Simulation</p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {(['intrinsic', 'n-type', 'p-type'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDopingType(mode)}
                      className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${dopingType === mode ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Doping concentration (cm⁻³)</label>
                  <input
                    type="range"
                    min={1e14}
                    max={1e19}
                    step={1e15}
                    value={dopingConcentration}
                    onChange={(event) => setDopingConcentration(Number(event.target.value))}
                    className="w-full accent-fuchsia-400"
                  />
                  <p className="text-xs text-slate-500">{dopingConcentration.toExponential(2)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow overflow-hidden">
            <div className="absolute inset-x-8 top-0 h-40 rounded-b-[3rem] bg-gradient-to-b from-fuchsia-500/10 via-transparent to-transparent blur-3xl" />
            <div className="relative z-10 space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Band structure visualization</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">Semiconductor Core</h2>
                </div>
                <div className="rounded-full bg-slate-900/80 px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-500/20">
                  {material} — {dopingResults.majority}
                </div>
              </div>
              <div className="relative overflow-hidden rounded-4xl border border-slate-800/70 bg-slate-950/85 p-6 shadow-inner">
                <div className="heat-wave absolute inset-x-0 top-0 h-24" />
                <div className="relative flex flex-col gap-10 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-4 xl:w-1/2">
                    <div className="flex items-center gap-3 text-slate-100">
                      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900/80 shadow-[0_0_40px_rgba(79,70,229,0.18)]">
                        <Cpu className="h-7 w-7 text-cyan-300" />
                      </div>
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Bandgap</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{simulation.Eg.toFixed(3)} eV</p>
                      </div>
                    </div>
                    <div className="space-y-4 rounded-3xl border border-slate-700/70 bg-slate-900/90 p-4">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Ec</span>
                        <span>{simulation.Ec.toFixed(3)} eV</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Ev</span>
                        <span>{simulation.Ev.toFixed(3)} eV</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-200">
                        <span>Ef</span>
                        <span>{simulation.Ef.toFixed(3)} eV</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative flex-1 rounded-[2.5rem] border border-slate-700/60 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-5 shadow-[inset_0_0_48px_rgba(14,16,39,0.5)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_42%)]" />
                    <div className="relative mx-auto flex max-w-xl flex-col items-center justify-center gap-6">
                      <div className="space-y-4 text-center">
                        <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/70">Electron excitation</p>
                        <h3 className="text-3xl font-semibold text-white">Band-to-band carrier burst</h3>
                      </div>
                      <div className="relative flex h-72 w-full items-center justify-center">
                        <div className="absolute inset-x-0 top-16 h-3 rounded-full bg-gradient-to-r from-indigo-500/40 via-cyan-400/30 to-fuchsia-400/30" />
                        <div className="absolute inset-x-0 bottom-16 h-3 rounded-full bg-gradient-to-r from-fuchsia-500/20 via-cyan-300/20 to-sky-400/10" />
                        <div className="absolute left-8 top-16 h-[190px] w-1 rounded-full bg-slate-800/80" />
                        <div className="absolute right-8 top-16 h-[190px] w-1 rounded-full bg-slate-800/80" />
                        <div className="absolute left-1/2 top-24 h-28 w-28 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
                        <div className="absolute left-1/2 top-36 h-20 w-20 -translate-x-1/2 rounded-full bg-fuchsia-500/15 blur-2xl" />
                        <div className="absolute left-1/2 top-20 h-36 w-36 -translate-x-1/2 rounded-full border border-cyan-400/20" />
                        <div className="relative flex h-full w-full items-center justify-center">
                          <div className="absolute left-[14%] top-[20%] h-6 w-6 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(56,189,248,0.65)]" style={{ transform: `translateX(${(temperature - 250) / 6}px)` }} />
                          <div className="absolute right-[14%] top-[62%] h-5 w-5 rounded-full bg-fuchsia-400 shadow-[0_0_14px_rgba(236,72,153,0.55)]" style={{ transform: `translateX(-${(temperature - 250) / 8}px)` }} />
                          <div className="absolute left-1/2 top-[18%] h-4 w-4 -translate-x-1/2 rounded-full bg-slate-100/40 blur-sm" />
                          <div className="absolute left-1/2 top-[50%] h-4 w-4 -translate-x-1/2 rounded-full bg-slate-100/40 blur-sm" />
                          <div className="absolute left-1/2 top-[75%] h-4 w-4 -translate-x-1/2 rounded-full bg-slate-100/40 blur-sm" />
                        </div>
                        <div className="absolute inset-x-0 bottom-12 mx-auto h-24 w-2 rounded-full bg-gradient-to-b from-cyan-400/40 to-transparent" />
                        <div className="absolute bottom-6 left-10 text-sm uppercase tracking-[0.24em] text-cyan-300/80">Valence band</div>
                        <div className="absolute top-8 right-12 text-sm uppercase tracking-[0.24em] text-fuchsia-300/80">Conduction band</div>
                        <div className="absolute top-8 left-12 text-sm uppercase tracking-[0.24em] text-slate-300/70">Eg</div>
                        <div className="absolute bottom-6 right-10 text-sm uppercase tracking-[0.24em] text-slate-300/70">Ef</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-4">
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Carrier explosion</p>
                  <p className="mt-3 text-3xl font-semibold text-cyan-300">{formatSci(simulation.ni, 2)} cm⁻³</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-4">
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Conductivity intensity</p>
                  <p className="mt-3 text-3xl font-semibold text-fuchsia-300">{formatSci(dopingResults.conductivity, 2)} S/cm</p>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow space-y-6">
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-500/20">
                <Wind className="h-4 w-4 text-cyan-300" /> Live Values Panel
              </div>
              <h2 className="text-xl font-semibold text-white">Real-Time Semiconductor Parameters</h2>
              <p className="text-sm text-slate-400">Instant updates as temperature and doping change the device physics.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Bandgap Energy Eg', value: `${simulation.Eg.toFixed(4)} eV`, tone: 'from-sky-400 to-cyan-400' },
                { label: 'Intrinsic Carrier Concentration ni', value: formatSci(simulation.ni, 2), tone: 'from-fuchsia-400 to-pink-400' },
                { label: 'Electrical Conductivity σ', value: `${formatSci(dopingResults.conductivity, 2)} S/cm`, tone: 'from-cyan-400 to-blue-500' },
                { label: 'Electron Mobility μe', value: `${simulation.muE.toFixed(1)} cm²/Vs`, tone: 'from-emerald-400 to-teal-400' },
                { label: 'Hole Mobility μh', value: `${simulation.muH.toFixed(1)} cm²/Vs`, tone: 'from-violet-400 to-indigo-500' },
                { label: 'Fermi Level Ef', value: `${simulation.Ef.toFixed(3)} eV`, tone: 'from-rose-400 to-fuchsia-500' },
                { label: 'Activation Energy Ea', value: `${simulation.activationEnergy.toFixed(3)} eV`, tone: 'from-orange-400 to-amber-400' },
                { label: 'Nc / Nv', value: `${formatSci(simulation.Nc, 1)} / ${formatSci(simulation.Nv, 1)}`, tone: 'from-cyan-300 to-sky-300' }
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-700/80 bg-slate-950/85 p-4 shadow-inner">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">{item.label}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-3xl bg-gradient-to-br ${item.tone} shadow-[0_0_24px_rgba(56,189,248,0.16)]`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Physics Interpretation</p>
                  <p className="mt-3 text-white">At high temperature, carrier generation dominates mobility reduction, causing conductivity to increase exponentially.</p>
                </div>
                <div className="rounded-full bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-sky-200">Dynamic Response</div>
              </div>
            </div>
          </section>
        </main>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Interactive graphs</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Advanced Performance Analytics</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/75 px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-700/50">
                <Download className="h-4 w-4 text-cyan-300" /> Export Data
              </div>
            </div>
            <div className="mt-6 grid gap-6">
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Conductivity vs Temperature</p>
                    <p className="mt-2 text-sm text-slate-300">Linear conductivity curve with live highlight.</p>
                  </div>
                  <button onClick={exportCSV} className="rounded-2xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Download CSV</button>
                </div>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="conductivityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 6" stroke="#23303c" />
                      <XAxis dataKey="T" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.16)' }} labelFormatter={(value) => `${value} K`} formatter={(value: number) => [value.toExponential(2), 'σ']} />
                      <Line type="monotone" dataKey="sigma" stroke="#38bdf8" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f472b6' }} />
                      <ReferenceDot x={temperature} y={dopingResults.conductivity} r={8} fill="#f472b6" stroke="#ffffff" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Arrhenius Plot</p>
                    <p className="mt-2 text-sm text-slate-300">ln(σ) vs 1/T and the extracted activation energy.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.2em] text-cyan-300">Ea ≈ {simulation.activationEnergy.toFixed(3)} eV</div>
                </div>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#23303c" />
                      <XAxis dataKey="invT" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => value.toFixed(4)} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.16)' }} formatter={(value: number) => [value.toFixed(3), 'ln(σ)']} labelFormatter={(value) => `1/T = ${value.toFixed(4)}`} />
                      <Line type="monotone" dataKey="logSigma" stroke="#fda4af" strokeWidth={3} dot={false} />
                      <ReferenceDot x={1/temperature} y={Math.log(Math.max(dopingResults.conductivity, 1e-24))} r={8} fill="#f472b6" stroke="#ffffff" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow space-y-6">
            <div className="grid gap-6">
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Carrier Concentration</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Exponential rise</h3>
                  </div>
                  <div className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-200">Log view</div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={graphData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="niGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#0f172a" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 6" stroke="#23303c" />
                      <XAxis dataKey="T" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.16)' }} formatter={(value: number) => [formatSci(value, 2), 'ni']} />
                      <Area type="monotone" dataKey="ni" stroke="#c084fc" fill="url(#niGradient)" strokeWidth={3} />
                      <ReferenceDot x={temperature} y={simulation.ni} r={8} fill="#f472b6" stroke="#ffffff" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Bandgap Narrowing</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Varshni temperature response</h3>
                  </div>
                  <div className="text-slate-300">Current Eg {simulation.Eg.toFixed(3)} eV</div>
                </div>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#23303c" />
                      <XAxis dataKey="T" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.16)' }} formatter={(value: number) => [value.toFixed(3), 'Eg']} />
                      <Line type="monotone" dataKey="Eg" stroke="#38bdf8" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Mobility vs Temperature</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Electron & hole mobility</h3>
                  </div>
                  <div className="rounded-full bg-slate-950/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">T^-2.2</div>
                </div>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={graphData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#23303c" />
                      <XAxis dataKey="T" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.16)' }} formatter={(value: number, name: string) => [`${value.toFixed(1)}`, name]} />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      <Line type="monotone" dataKey="muE" stroke="#60a5fa" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="muH" stroke="#f472b6" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Application contexts</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Real Device Applications</h2>
            </div>
            <div className="rounded-full bg-slate-900/75 px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-700/50">Integrated lab perspectives</div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {[
              { title: 'Smartphones', body: 'Thermal rise alters leakage and current flow in CMOS logic, requiring wide bandgap design for efficiency.' },
              { title: 'Solar Cells', body: 'Increasing temperature reduces bandgap and changes the current-voltage curve in photovoltaic junctions.' },
              { title: 'Thermistors', body: 'Semiconductor resistivity is used for temperature sensing with nonlinear conductivity increase.' },
              { title: 'Automotive Electronics', body: 'Devices must tolerate wide thermal swings while maintaining stable conductivity and carrier mobility.' },
              { title: 'Power Electronics', body: 'Wide-bandgap materials like SiC and GaN keep conductivity high at elevated temperatures for efficient power switching.' }
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-700/70 bg-slate-950/85 p-5 shadow-inner">
                <div className="flex items-center gap-3 text-slate-200">
                  <Zap className="h-5 w-5 text-cyan-300" />
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                </div>
                <p className="mt-3 text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">AI Insight Panel</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Automated Physical Intelligence</h2>
              </div>
              <button onClick={printReport} className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-400"><Download className="h-4 w-4" /> Print Report</button>
            </div>
            <div className="mt-6 space-y-4">
              {insights.map((message) => (
                <motion.div key={message} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-700/70 bg-slate-900/85 p-4 text-slate-200 shadow-inner">
                  <p className="text-sm">{message}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <aside className="glass-panel rounded-3xl border border-white/10 p-6 shadow-glow space-y-6">
            <div className="flex items-center gap-3 text-slate-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900/70 text-cyan-300 shadow-[0_0_26px_rgba(56,189,248,0.14)]">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Educational Mode</p>
                <p className="mt-1 text-lg font-semibold text-white">What is happening?</p>
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4 text-slate-300">
              <p><span className="font-semibold text-white">Intrinsic silicon conductivity</span> comes from thermal generation of electron-hole pairs across the bandgap. As temperature grows, Eg narrows and ni rises exponentially.</p>
              <p><span className="font-semibold text-white">Fermi level</span> sits near midgap for intrinsic material and shifts with effective mass ratio and thermal broadening.</p>
              <p><span className="font-semibold text-white">Mobility</span> decreases with temperature, but carrier multiplication usually dominates, raising total conductivity.</p>
            </div>
            <button className="w-full rounded-3xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110">Show Step-by-Step Tutorial</button>
          </aside>
        </section>
      </div>
    </div>
  );
}

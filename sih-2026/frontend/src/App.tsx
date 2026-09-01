import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { UploadZone } from './components/UploadZone';
import { SamplePicker } from './components/SamplePicker';
import { ProgressModal } from './components/ProgressModal';
import { ResultsViewer } from './components/ResultsViewer';
import { CalibrationModal } from './components/CalibrationModal';
import { HowItWorks } from './components/HowItWorks';
import { HistoryDrawer } from './components/HistoryDrawer';
import {
  SampleItem,
  JobStatus,
  JobResult,
  HistoryItem,
  AdvancedGeoSettings,
} from './types';
import {
  fetchSamples,
  uploadImage,
  processSample,
  pollJob,
} from './services/api';

export const App: React.FC = () => {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [currentResult, setCurrentResult] = useState<JobResult | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('dw_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Modals & Drawers
  const [showCalibration, setShowCalibration] = useState<boolean>(false);
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // History stored in localStorage
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('dw_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load sample images on mount
  useEffect(() => {
    fetchSamples()
      .then((data) => setSamples(data))
      .catch((err) => console.warn('Could not load samples:', err));
  }, []);

  // Update theme class on HTML element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('dw_theme', theme);
    } catch (e) {
      console.warn('Could not save theme:', e);
    }
  }, [theme]);

  // Save history to localStorage
  const saveToHistory = (result: JobResult, name: string) => {
    const newItem: HistoryItem = {
      job_id: result.job_id,
      timestamp: Date.now(),
      thumbnail_url: result.original_url,
      name,
      stats: result.stats,
      result,
    };
    const updated = [newItem, ...history.filter((h) => h.job_id !== result.job_id)].slice(0, 20);
    setHistory(updated);
    try {
      localStorage.setItem('dw_history', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('dw_history');
  };

  // Handle User Upload
  const handleUpload = async (file: File, settings?: AdvancedGeoSettings) => {
    try {
      setIsProcessing(true);
      setJobStatus({
        job_id: '',
        status: 'queued',
        progress: 5,
        message: 'Uploading raster to neural disparity pipeline...',
      });

      const jobId = await uploadImage(file, settings);
      setJobStatus((prev) => (prev ? { ...prev, job_id: jobId } : null));

      const result = await pollJob(jobId, (st) => setJobStatus(st));
      setCurrentResult(result);
      saveToHistory(result, file.name);
    } catch (err: any) {
      console.error(err);
      setJobStatus({
        job_id: '',
        status: 'error',
        progress: 0,
        message: 'Processing failed',
        error: err.message || 'An error occurred during inference',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Preset Sample Selection
  const handleSelectSample = async (sampleId: string) => {
    try {
      const sample = samples.find((s) => s.id === sampleId);
      setIsProcessing(true);
      setJobStatus({
        job_id: '',
        status: 'queued',
        progress: 5,
        message: `Synthesizing survey plate: ${sample?.name || sampleId}...`,
      });

      const jobId = await processSample(sampleId);
      setJobStatus((prev) => (prev ? { ...prev, job_id: jobId } : null));

      const result = await pollJob(jobId, (st) => setJobStatus(st));
      setCurrentResult(result);
      saveToHistory(result, sample?.name || `Plate ${sampleId}`);
    } catch (err: any) {
      console.error(err);
      setJobStatus({
        job_id: '',
        status: 'error',
        progress: 0,
        message: 'Sample processing failed',
        error: err.message || 'An error occurred during inference',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewScan = () => {
    setCurrentResult(null);
    setJobStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToUpload = () => {
    const el = document.getElementById('upload-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-topo-canvas text-topo-ink selection:bg-topo-ochre selection:text-topo-canvas">
      
      {/* Navbar */}
      <Navbar
        onOpenCalibration={() => setShowCalibration(true)}
        onOpenHowItWorks={() => setShowHowItWorks(true)}
        onOpenHistory={() => setShowHistory(true)}
        historyCount={history.length}
        onNewScan={handleNewScan}
        hasResult={!!currentResult}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      {/* Main Content */}
      <main className="flex-1 pb-16">
        {!currentResult ? (
          <>
            <Hero
              onScrollToUpload={scrollToUpload}
              onSelectPreset={() => samples[0] && handleSelectSample(samples[0].id)}
            />
            
            <SamplePicker
              samples={samples}
              isLoading={isProcessing}
              onSelectSample={handleSelectSample}
            />

            <UploadZone
              onUpload={handleUpload}
              isLoading={isProcessing}
            />
          </>
        ) : (
          <ResultsViewer
            result={currentResult}
            onOpenCalibration={() => setShowCalibration(true)}
            onNewScan={handleNewScan}
            theme={theme}
          />
        )}
      </main>

      {/* Cartographic Footer */}
      <footer className="w-full border-t border-topo-border bg-topo-panel py-4 text-[11px] font-mono text-topo-inkDim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DEPTHWIZARD // TOPOGRAPHICAL DEM ENGINE &bull; VERSION 1.0</span>
          <span>
            SPATIAL DATUM: WGS84 PREVIEW (0–100 RELATIVE UNITS) &bull; 32-BIT FLOAT GEOTIFF
          </span>
        </div>
      </footer>

      {/* Progress Telemetry Modal */}
      <ProgressModal
        status={jobStatus}
        isOpen={isProcessing}
      />

      {/* Geodetic Datum Continuum Modal */}
      <CalibrationModal
        isOpen={showCalibration}
        onClose={() => setShowCalibration(false)}
      />

      {/* Survey Instrument Schematic Modal */}
      <HowItWorks
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />

      {/* Cadastral Archive Drawer */}
      <HistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onSelectHistory={(item) => setCurrentResult(item.result)}
        onClearHistory={handleClearHistory}
      />

    </div>
  );
};

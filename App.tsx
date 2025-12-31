import React, { useState } from 'react';
import { MapPin, Info, AlertTriangle, Layers, Mic, Search, ChevronRight, CheckCircle2, Loader2, ArrowRight, Locate, FileDown, DollarSign, Lightbulb } from 'lucide-react';
import MapComponent from './components/MapComponent';
import AtlasOracleCallModal, { VoiceVars } from './components/AtlasOracleCallModal';
import { AnalysisResult, Coordinates, LoadingState } from './types';
import { fetchNearbyPOIs, fetchReverseGeocode, fetchWeatherAndElevation } from './services/geoData';
import { analyzeWithGemini } from './services/gemini';
import { generatePDF } from './services/pdfGenerator';

// Default start location (e.g., San Francisco)
const DEFAULT_COORDS: Coordinates = { lat: 37.7749, lng: -122.4194 };

function App() {
  const [coords, setCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [radius, setRadius] = useState<number>(2);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Manual Input State
  const [manualLat, setManualLat] = useState<string>(DEFAULT_COORDS.lat.toString());
  const [manualLng, setManualLng] = useState<string>(DEFAULT_COORDS.lng.toString());

  const handleCoordsChange = (newCoords: Coordinates) => {
    setCoords(newCoords);
    setManualLat(newCoords.lat.toFixed(6));
    setManualLng(newCoords.lng.toFixed(6));
  };

  const handleManualInputApply = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      handleCoordsChange({ lat, lng });
    }
  };

  const handleUseMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleCoordsChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (err) => {
        console.error(err);
        setError("Unable to retrieve location. Please check browser permissions.");
      }
    );
  };

  const handleAnalyze = async () => {
    setLoadingState('fetching_data');
    setError(null);
    setResult(null);

    try {
      // 1. Fetch Raw Data
      const [weather, reverseGeo, pois] = await Promise.all([
        fetchWeatherAndElevation(coords),
        fetchReverseGeocode(coords),
        fetchNearbyPOIs(coords, radius)
      ]);

      const contextData = {
        timestamp: new Date().toISOString(),
        nominatim: reverseGeo,
        weather: weather,
        pois: pois ? pois.slice(0, 50) : [] // Limit POI context size
      };

      setLoadingState('reasoning');

      // 2. Gemini Reasoning
      const analysis = await analyzeWithGemini(coords, radius, contextData);
      setResult(analysis);
      setLoadingState('complete');

    } catch (err: any) {
      console.error(err);
      setError("Analysis failed. Please try again. " + (err?.message || ""));
      setLoadingState('error');
    }
  };

  const handleExportPDF = () => {
    if (result) {
      generatePDF(result, coords, radius);
    }
  };

  // Voice button is disabled if we don't have a result yet
  const isVoiceEnabled = !!result;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-slate-800 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-sm flex items-center justify-center">
            <Layers className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">ATLAS ORACLE</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => isVoiceEnabled && setIsVoiceModalOpen(true)}
            disabled={!isVoiceEnabled}
            title={isVoiceEnabled ? "Start Voice Session" : "Run Analyze Location to enable voice guidance"}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-full ${
              isVoiceEnabled 
                ? 'text-slate-600 hover:text-teal-700 hover:bg-slate-50 cursor-pointer' 
                : 'text-slate-400 opacity-60 cursor-not-allowed bg-transparent'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Voice Agent</span>
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Left Panel: Controls & Results */}
        <div className="lg:col-span-5 h-full overflow-y-auto border-r border-slate-200 bg-white flex flex-col">
          
          {/* Controls Section */}
          <div className="p-6 border-b border-slate-100 space-y-6">
            
            {/* Location Header & Share Button */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Location Coordinates</h3>
                 <button 
                   onClick={handleUseMyLocation}
                   className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors border border-slate-200"
                 >
                   <Locate className="w-3.5 h-3.5" />
                   Share My Location
                 </button>
              </div>

              {/* Coordinates Input */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Latitude</label>
                  <input 
                    type="text" 
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    onBlur={handleManualInputApply}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Longitude</label>
                  <input 
                    type="text" 
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    onBlur={handleManualInputApply}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Radius Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Analysis Radius</label>
              <div className="flex gap-2">
                {[1, 2, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`flex-1 py-2 text-sm font-medium border rounded transition-colors ${
                      radius === r 
                        ? 'bg-slate-800 text-white border-slate-800' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleAnalyze}
              disabled={loadingState === 'fetching_data' || loadingState === 'reasoning'}
              className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {(loadingState === 'fetching_data' || loadingState === 'reasoning') ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loadingState === 'fetching_data' ? 'Gathering Data...' : 'Reasoning...'}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Analyze Location
                </>
              )}
            </button>
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded text-red-700 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {!result && loadingState === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                <MapPin className="w-12 h-12 mb-4" />
                <p className="text-sm font-medium">Select a location and click Analyze</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Result Header & Export */}
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analysis Results</h3>
                   <button 
                     onClick={handleExportPDF}
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-100 rounded-md hover:bg-teal-100 transition-colors"
                   >
                     <FileDown className="w-3.5 h-3.5" />
                     Export PDF
                   </button>
                </div>

                {/* Area Summary */}
                <div className="bg-white p-5 rounded border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Location Overview</h3>
                  <p className="text-slate-800 leading-relaxed">{result.area_summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200">
                      {result.evidence.reverse_geocode_label.split(',')[0]}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200">
                      {result.evidence.weather_now}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200">
                      {result.evidence.elevation_m}m Elev.
                    </span>
                  </div>
                </div>

                {/* Top Opportunities (Enriched) */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Top Business Opportunities</h3>
                  <div className="space-y-4">
                    {result.top_opportunities.map((opp, idx) => (
                      <div key={idx} className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start">
                           <div>
                             <h4 className="font-bold text-slate-900 text-lg">{opp.name}</h4>
                             <p className="text-sm text-slate-600 mt-1">{opp.rationale}</p>
                           </div>
                           <span className={`text-xs font-mono px-2 py-0.5 rounded ml-2 shrink-0 ${
                             opp.confidence_0_100 > 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                           }`}>
                             {opp.confidence_0_100}% Conf.
                           </span>
                        </div>
                        
                        {/* Concept Details */}
                        <div className="p-4 bg-white">
                           <div className="flex items-start gap-3 mb-4">
                             <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                               <Lightbulb className="w-4 h-4 text-teal-700" />
                             </div>
                             <div>
                               <h5 className="text-xs font-bold text-slate-400 uppercase mb-1">Concept Example</h5>
                               <p className="font-medium text-slate-900 text-sm">"{opp.example_project}"</p>
                               <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opp.project_description}</p>
                             </div>
                           </div>

                           {/* Cost Estimate */}
                           <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                               <DollarSign className="w-4 h-4 text-slate-600" />
                             </div>
                             <div className="w-full">
                               <div className="flex justify-between items-center mb-1">
                                 <h5 className="text-xs font-bold text-slate-400 uppercase">Est. Startup Cost</h5>
                                 <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{opp.estimated_cost?.total || "N/A"}</span>
                               </div>
                               <div className="space-y-1">
                                  {opp.estimated_cost?.breakdown?.map((cost, cIdx) => (
                                    <div key={cIdx} className="text-xs text-slate-500 flex items-center gap-1.5">
                                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                      {cost}
                                    </div>
                                  ))}
                               </div>
                               <p className="text-[10px] text-slate-400 mt-2 italic">
                                 *Rough estimate only. Does not constitute financial advice.
                               </p>
                             </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Land Use & Risks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Land Use
                    </h3>
                    <ul className="space-y-2">
                      {result.land_use_suggestions.map((item, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="block w-1 h-1 bg-teal-500 rounded-full mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Risks
                    </h3>
                    <ul className="space-y-2">
                      {result.risks.map((item, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="block w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-slate-800 text-slate-100 p-5 rounded shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Strategic Recommendations</h3>
                  <ul className="space-y-3">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed">
                        <ArrowRight className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                
                 {/* Voice Payload Preview */}
                 <div className="bg-white p-5 rounded border border-slate-200 shadow-sm opacity-75">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Voice Agent Context</h3>
                  <pre className="text-[10px] bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto text-slate-500">
                    {JSON.stringify(result.voice_payload, null, 2)}
                  </pre>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Map */}
        <div className="lg:col-span-7 h-full relative border-l border-slate-200 bg-slate-200">
          <MapComponent coords={coords} onCoordsChange={handleCoordsChange} radiusKm={radius} />
          
          {/* Map Overlay Info */}
          <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md p-3 rounded-lg border border-white/50 shadow-sm z-[1000] pointer-events-none flex justify-between items-center text-xs text-slate-600">
             <div>
                <span className="font-bold text-slate-800">Selected Location: </span> 
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
             </div>
             <div>
               Radius: <span className="font-bold text-slate-800">{radius}km</span>
             </div>
          </div>
        </div>
      </main>

      <AtlasOracleCallModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)} 
        voiceVars={result ? result.voice_payload : null}
      />
    </div>
  );
}

export default App;
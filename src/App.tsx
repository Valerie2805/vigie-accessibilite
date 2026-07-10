import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Home from "@/pages/Home";
import CompanyPage from "@/pages/CompanyPage";
import AnalysisPage from "@/pages/AnalysisPage";
import HistoryPage from "@/pages/HistoryPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entreprise/:siren" element={<CompanyPage />} />
          <Route path="/analyse/:scanId" element={<AnalysisPage />} />
          <Route path="/historique" element={<HistoryPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

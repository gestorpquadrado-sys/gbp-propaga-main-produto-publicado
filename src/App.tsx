import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import LocationSelector from "./pages/LocationSelector";
import DirectoryPanel from "./pages/DirectoryPanel";
import PublicCompanyPage from "./pages/PublicCompanyPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><LocationSelector /></ProtectedRoute>} />
            <Route path="/form" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/panel/:locationId" element={<ProtectedRoute><DirectoryPanel /></ProtectedRoute>} />
            <Route path="/panel/locations/:locationId" element={<ProtectedRoute><DirectoryPanel /></ProtectedRoute>} />
            <Route path="/empresa/:slug" element={<PublicCompanyPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

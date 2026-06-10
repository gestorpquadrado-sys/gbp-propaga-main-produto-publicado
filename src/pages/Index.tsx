import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import BusinessProfileForm from '@/components/BusinessProfileForm';
import { GoogleImportModal } from '@/components/GoogleImportModal';
import type { GoogleLocation } from '@/components/GoogleImportModal';

const Index = () => {
  const formRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleScrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImport = (location: GoogleLocation) => {
    navigate('/form', { state: { importedLocation: location } });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero onScrollToForm={handleScrollToForm} />

      <div className="container mx-auto px-6 py-12">
        <div className="flex justify-end mb-6">
          <GoogleImportModal onSelect={handleImport} />
        </div>
        <div ref={formRef}>
          <BusinessProfileForm />
        </div>
      </div>
    </div>
  );
};

export default Index;

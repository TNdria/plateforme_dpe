import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
}

const PaginationControls = ({ currentPage, totalPages, totalItems, onPrev, onNext }: PaginationControlsProps) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between p-3 border-t bg-card">
      <span className="text-xs sm:text-sm text-muted-foreground">
        Page {currentPage}/{totalPages} ({totalItems} résultats)
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={currentPage === 1}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Précédent</span>
        </Button>
        <span className="text-sm font-medium px-2">{currentPage}</span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={currentPage === totalPages}>
          <span className="hidden sm:inline">Suivant</span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default PaginationControls;

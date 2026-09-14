export interface PublicProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImageId: string | null;
  coverImageUrl: string | null;
  updatedAt: string | null;
  createdAt: string;
  endDate: string | null;
  office: {
    id: string;
    name: string;
    slug: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  milestoneProgress: {
    totalSteps: number;
    completedSteps: number;
    currentStep: number;
    currentStepTitle: string;
  } | null;
}

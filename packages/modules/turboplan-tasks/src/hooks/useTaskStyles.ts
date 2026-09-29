import { TaskStatus } from "../types";

interface TaskStyles {
  backgroundColor: string;
  backgroundSelectedColor: string;
  progressColor: string;
  progressSelectedColor: string;
  text?: {
    colorInsideBar: string;
    colorOutsideBar: string;
  };
  dragHandleColor?: string;
  border?: {
    color: string;
    width: number;
  };
  diagonalHatchColor?: string;
}

export const useTaskStyles = () => {
  const colors: Array<{ initiated: TaskStyles; notInitiated: TaskStyles }> = [
    // Brand-family rotation (glass UI): brand green, teal, sage, forest,
    // olive. Fills stay light; borders/text are the -500/-600 tones.
    palette.brand,
    palette.turkish,
    palette.sage,
    palette.forest,
    palette.olive,
  ].map((color) => ({
    initiated: {
      backgroundColor: color[25],
      backgroundSelectedColor: color[25],
      progressColor: color[50],
      progressSelectedColor: color[50],
      text: {
        colorInsideBar: color[600],
        colorOutsideBar: color[600],
      },
      dragHandleColor: color[25],
      border: {
        color: color[500],
        width: 1,
      },
    },
    notInitiated: {
      backgroundColor: palette.grey[50],
      backgroundSelectedColor: palette.grey[50],
      progressColor: color[50],
      progressSelectedColor: color[50],
      diagonalHatchColor: color[500],
      dragHandleColor: color[25],
      text: {
        colorInsideBar: color[600],
        colorOutsideBar: color[600],
      },
      border: {
        color: color[500],
        width: 1,
      },
    },
  }));

  const getTaskStyles = ({
    index,
  }: {
    index: number;
  }): { initiated: TaskStyles; notInitiated: TaskStyles } => {
    return colors[index % colors.length];
  };

  return {
    getTaskStyles,
  };
};

const palette = {
  brand: {
    "25": "#E3F4EC",
    "50": "#CDEBDD",
    "500": "#1B845C",
    "600": "#12563C",
  },
  sage: {
    "25": "#E8F1ED",
    "50": "#D1E6DE",
    "500": "#3C7A62",
    "600": "#156647",
  },
  turkish: {
    "25": "#DCEDEF",
    "50": "#CFE4E7",
    "500": "#097F8A",
    "600": "#097079",
  },
  hibiscus: {
    "25": "#F6E5EB",
    "50": "#F2D9E3",
    "500": "#B13F6B",
    "600": "#B13F6B",
  },
  grape: {
    "25": "#EDE3F7",
    "50": "#E4D7F2",
    "500": "#5A11A1",
    "600": "#5A11A1",
  },
  sapphire: {
    "25": "#E1E6F9",
    "50": "#D7DFF6",
    "500": "#3049BD",
    "600": "#3049BD",
  },
  forest: {
    "25": "#DDEEE1",
    "50": "#CFE5D5",
    "500": "#063619",
    "600": "#063619",
  },
  olive: {
    "25": "#DEE5CD",
    "50": "#D2D9BB",
    "500": "#496501",
    "600": "#496501",
  },
  amber: {
    "25": "#F4DBD2",
    "50": "#EFCEC3",
    "500": "#912801",
    "600": "#902801",
  },
  grey: {
    "50": "#f0f0f0",
  },
};

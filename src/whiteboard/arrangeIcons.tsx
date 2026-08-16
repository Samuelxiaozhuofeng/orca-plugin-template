import type { ArrangeAction } from "./selection";

const svg = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": true as const,
};

function Line({ d }: { d: string }) {
  return (
    <path
      d={d}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  );
}

function Box(props: { x: number; y: number; w: number; h: number }) {
  return (
    <rect
      x={props.x}
      y={props.y}
      width={props.w}
      height={props.h}
      rx="0.8"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  );
}

export function AlignTriggerIcon() {
  return (
    <svg {...svg}>
      <Line d="M2.5 2.5v11" />
      <Box x={5} y={3.5} w={8} h={3.4} />
      <Box x={5} y={9.1} w={5.5} h={3.4} />
    </svg>
  );
}

export function WrapSectionIcon() {
  return (
    <svg {...svg}>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <Box x={3.4} y={4.6} w={4} h={6.6} />
      <Box x={8.6} y={4.6} w={4} h={6.6} />
    </svg>
  );
}

function AlignLeftIcon() {
  return (
    <svg {...svg}>
      <Line d="M2.5 2.5v11" />
      <Box x={4.5} y={3.4} w={8.5} h={3.4} />
      <Box x={4.5} y={9.2} w={5.5} h={3.4} />
    </svg>
  );
}

function AlignCenterXIcon() {
  return (
    <svg {...svg}>
      <Line d="M8 2.5v11" />
      <Box x={3.2} y={3.4} w={9.6} h={3.4} />
      <Box x={4.8} y={9.2} w={6.4} h={3.4} />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg {...svg}>
      <Line d="M13.5 2.5v11" />
      <Box x={3} y={3.4} w={8.5} h={3.4} />
      <Box x={6} y={9.2} w={5.5} h={3.4} />
    </svg>
  );
}

function AlignTopIcon() {
  return (
    <svg {...svg}>
      <Line d="M2.5 2.5h11" />
      <Box x={3.4} y={4.5} w={3.4} h={8.5} />
      <Box x={9.2} y={4.5} w={3.4} h={5.5} />
    </svg>
  );
}

function AlignCenterYIcon() {
  return (
    <svg {...svg}>
      <Line d="M2.5 8h11" />
      <Box x={3.4} y={3.2} w={3.4} h={9.6} />
      <Box x={9.2} y={4.8} w={3.4} h={6.4} />
    </svg>
  );
}

function AlignBottomIcon() {
  return (
    <svg {...svg}>
      <Line d="M2.5 13.5h11" />
      <Box x={3.4} y={3} w={3.4} h={8.5} />
      <Box x={9.2} y={6} w={3.4} h={5.5} />
    </svg>
  );
}

function DistributeXIcon() {
  return (
    <svg {...svg}>
      <Box x={1.6} y={5} w={3} h={6} />
      <Box x={6.5} y={5} w={3} h={6} />
      <Box x={11.4} y={5} w={3} h={6} />
    </svg>
  );
}

function DistributeYIcon() {
  return (
    <svg {...svg}>
      <Box x={5} y={1.6} w={6} h={3} />
      <Box x={5} y={6.5} w={6} h={3} />
      <Box x={5} y={11.4} w={6} h={3} />
    </svg>
  );
}

function TidyGridIcon() {
  return (
    <svg {...svg}>
      <Box x={2.4} y={2.4} w={4.4} h={4.4} />
      <Box x={9.2} y={2.4} w={4.4} h={4.4} />
      <Box x={2.4} y={9.2} w={4.4} h={4.4} />
      <Box x={9.2} y={9.2} w={4.4} h={4.4} />
    </svg>
  );
}

export type ArrangeCell = {
  action: ArrangeAction;
  title: string;
  min: number;
  Icon: () => React.ReactNode;
};

/** 3×3: align row, align column, then distribute + tidy. */
export const ARRANGE_CELLS: readonly ArrangeCell[] = [
  { action: "alignLeft", title: "Align left", min: 2, Icon: AlignLeftIcon },
  {
    action: "alignCenterX",
    title: "Align horizontal centers",
    min: 2,
    Icon: AlignCenterXIcon,
  },
  { action: "alignRight", title: "Align right", min: 2, Icon: AlignRightIcon },
  { action: "alignTop", title: "Align top", min: 2, Icon: AlignTopIcon },
  {
    action: "alignCenterY",
    title: "Align vertical centers",
    min: 2,
    Icon: AlignCenterYIcon,
  },
  { action: "alignBottom", title: "Align bottom", min: 2, Icon: AlignBottomIcon },
  {
    action: "distributeX",
    title: "Distribute horizontally",
    min: 3,
    Icon: DistributeXIcon,
  },
  {
    action: "distributeY",
    title: "Distribute vertically",
    min: 3,
    Icon: DistributeYIcon,
  },
  { action: "grid", title: "Tidy up to grid", min: 2, Icon: TidyGridIcon },
];

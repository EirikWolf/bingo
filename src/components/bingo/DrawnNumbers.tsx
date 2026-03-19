import { NumberBall } from './NumberBall';

interface DrawnNumbersProps {
  numbers: number[];
  maxVisible?: number;
}

export function DrawnNumbers({ numbers, maxVisible = 5 }: DrawnNumbersProps) {
  const recent = numbers.slice(-maxVisible).reverse();

  if (numbers.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-1">Venter på første tall...</p>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1">
      {recent.map((num, i) => (
        <NumberBall
          key={num}
          number={num}
          size="sm"
          animate={i === 0}
        />
      ))}
      {numbers.length > maxVisible && (
        <span className="text-xs text-gray-400 whitespace-nowrap">
          +{numbers.length - maxVisible} til
        </span>
      )}
    </div>
  );
}

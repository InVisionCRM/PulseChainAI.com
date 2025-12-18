import { ReactNode } from 'react';

// Import the existing formatter from AdminStatsPanel
// We'll need to export it from there or create a shared utility
const formatResponseForDisplay = (response: any): { displayValue: string; displayType: 'value' | 'table' | 'object' | 'array' } => {
  // Handle null/undefined
  if (response == null) {
    return { displayValue: 'N/A', displayType: 'value' };
  }

  // Handle objects with 'formatted' property (most common)
  if (typeof response === 'object' && 'formatted' in response) {
    return { displayValue: response.formatted, displayType: 'value' };
  }

  // Handle arrays (like topHolders, allPools)
  if (Array.isArray(response)) {
    if (response.length === 0) {
      return { displayValue: 'No data available', displayType: 'value' };
    }

    // For arrays of objects, we'll show as table format
    if (typeof response[0] === 'object') {
      return { displayValue: `${response.length} items`, displayType: 'array' };
    }

    // For arrays of primitives
    return { displayValue: response.join(', '), displayType: 'array' };
  }

  // Handle primitive values
  if (typeof response === 'string') {
    // Check if it's an address
    if (response.startsWith('0x') && response.length === 42) {
      return { displayValue: `${response.slice(0, 6)}...${response.slice(-4)}`, displayType: 'value' };
    }
    return { displayValue: response, displayType: 'value' };
  }

  if (typeof response === 'number') {
    return { displayValue: response.toLocaleString(), displayType: 'value' };
  }

  if (typeof response === 'boolean') {
    return { displayValue: response ? 'Yes' : 'No', displayType: 'value' };
  }

  // Handle complex objects without 'formatted' property
  if (typeof response === 'object') {
    // Count meaningful properties
    const meaningfulProps = Object.entries(response).filter(([key, value]) =>
      value !== null && value !== undefined && value !== ''
    );

    if (meaningfulProps.length === 1) {
      // Single property - show just the value
      const [key, value] = meaningfulProps[0];
      return formatResponseForDisplay(value);
    } else if (meaningfulProps.length <= 3) {
      // Few properties - show as formatted object
      return { displayValue: '', displayType: 'object' };
    } else {
      // Many properties - show count
      return { displayValue: `${meaningfulProps.length} properties`, displayType: 'object' };
    }
  }

  // Fallback
  return { displayValue: String(response), displayType: 'value' };
};

// Array formatter for things like top holders
export const formatArrayResponse = (items: any[]): ReactNode => {
  if (!Array.isArray(items) || items.length === 0) {
    return <span className="text-gray-500 italic">No items</span>;
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 50).map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // Handle holder objects
          if (item.address && (item.balanceFormatted || item.balanceRaw)) {
            const balance = item.balanceFormatted || formatResponseForDisplay(item.balanceRaw).displayValue;
            const percentage = item.percentage ? ` (${item.percentage})` : '';

            return (
              <div key={index} className="flex items-center justify-between py-1 border-b border-gray-200 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 w-6">{index + 1}.</span>
                  <span className="font-mono text-xs text-blue-600">
                    {item.address.slice(0, 8)}...{item.address.slice(-6)}
                  </span>
                </div>
                <span className="text-xs font-medium text-gray-900">
                  {balance}{percentage}
                </span>
              </div>
            );
          }

          // Handle transaction objects
          if (item.txHash || item.transactionHash) {
            const hash = item.txHash || item.transactionHash;
            const value = item.value || item.total?.value;
            const formattedValue = value ? formatResponseForDisplay(value).displayValue : '';

            return (
              <div key={index} className="py-1 border-b border-gray-200 last:border-b-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500 w-6">{index + 1}.</span>
                  <span className="font-mono text-xs text-blue-600">
                    {hash.slice(0, 8)}...{hash.slice(-6)}
                  </span>
                </div>
                {formattedValue && (
                  <span className="text-xs text-gray-700 ml-8">
                    Value: {formattedValue}
                  </span>
                )}
              </div>
            );
          }

          // Generic object display
          return (
            <div key={index} className="py-2 border-b border-gray-200 last:border-b-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-500 w-6">{index + 1}.</span>
                <span className="text-xs font-medium text-gray-700">Object</span>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap ml-8">
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          );
        }

        // Primitive values
        return (
          <div key={index} className="flex items-center gap-2 py-1 border-b border-gray-200 last:border-b-0">
            <span className="text-xs font-mono text-gray-500 w-6">{index + 1}.</span>
            <span className="text-xs text-gray-900">{String(item)}</span>
          </div>
        );
      })}

      {items.length > 50 && (
        <div className="text-center py-2 text-xs text-gray-500 border-t border-gray-200">
          ... and {items.length - 50} more items
        </div>
      )}
    </div>
  );
};

// Object formatter for complex results
export const formatObjectResponse = (obj: any): ReactNode => {
  if (!obj || typeof obj !== 'object') {
    return <span className="text-gray-700">{String(obj)}</span>;
  }

  const entries = Object.entries(obj);

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const formattedValue = formatResponseForDisplay(value);

        return (
          <div key={key} className="flex justify-between items-start py-1 border-b border-gray-200 last:border-b-0">
            <span className="text-xs font-medium text-gray-700 capitalize flex-shrink-0 mr-4">
              {key.replace(/([A-Z])/g, ' $1')}:
            </span>
            <span className="text-xs text-gray-900 text-right flex-1">
              {formattedValue.displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Main formatter selector
export const getResponseFormatter = (data: any) => {
  if (Array.isArray(data)) {
    return formatArrayResponse;
  }

  if (typeof data === 'object' && data !== null) {
    return formatObjectResponse;
  }

  // For primitives, just show the formatted value
  return (value: any) => (
    <div className="text-center py-4">
      <span className="text-lg font-semibold text-gray-900">
        {formatResponseForDisplay(value).displayValue}
      </span>
    </div>
  );
};
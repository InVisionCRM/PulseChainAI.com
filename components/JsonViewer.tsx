import React, { useState } from 'react';

// Define proper types for JSON data
type JsonValue = string | number | boolean | null | { [key: string]: any } | any[];
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

// Helper to determine the type of a value
const getValueType = (value: JsonValue): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

// Forward declarations for recursive components
let JsonObjectComponent: React.FC<{ data: JsonObject }>;
let JsonArrayComponent: React.FC<{ data: JsonArray }>;

// Component to render a single JSON value
const JsonValue: React.FC<{ value: JsonValue }> = ({ value }) => {
    const type = getValueType(value);

    switch (type) {
        case 'string':
            return <span className="text-green-400">&quot;{String(value)}&quot;</span>;
        case 'number':
            return <span className="text-sky-400">{String(value)}</span>;
        case 'boolean':
            return <span className="text-yellow-400">{String(value)}</span>;
        case 'null':
            return <span className="text-slate-500">null</span>;
        case 'object':
            return <JsonObjectComponent data={value as JsonObject} />;
        case 'array':
            return <JsonArrayComponent data={value as JsonArray} />;
        default:
            return <span className="text-red-400">Unsupported Type</span>;
    }
};

// Component for JSON Objects
JsonObjectComponent = ({ data }) => {
    const [isOpen, setIsOpen] = useState(true);
    const keys = Object.keys(data);

    if (keys.length === 0) {
        return <span className="text-slate-200">{`{}`}</span>;
    }
    
    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} className="text-slate-400 hover:text-white focus:outline-none">
                {`{...}`} <span className="text-xs text-slate-500">({keys.length} items)</span>
            </button>
        );
    }

    return (
        <div>
            <button onClick={() => setIsOpen(false)} className="text-slate-200 hover:text-white focus:outline-none">{`{`}</button>
            <div className="pl-4 border-l border-slate-700">
                {keys.map((key, index) => (
                    <div key={key} className="flex">
                        <span className="text-purple-400 shrink-0">&quot;{key}&quot;:&nbsp;</span>
                        <div className="flex-grow">
                            <JsonValue value={data[key]} />
                            {index < keys.length - 1 && <span className="text-slate-200">,</span>}
                        </div>
                    </div>
                ))}
            </div>
            <span className="text-slate-200">{`}`}</span>
        </div>
    );
};

// Add display name for JsonObjectComponent
JsonObjectComponent.displayName = 'JsonObjectComponent';

// Component for JSON Arrays
JsonArrayComponent = ({ data }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (data.length === 0) {
        return <span className="text-slate-200">[]</span>;
    }

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} className="text-slate-400 hover:text-white focus:outline-none">
                [...] <span className="text-xs text-slate-500">({data.length} items)</span>
            </button>
        );
    }
    
    return (
        <div>
            <button onClick={() => setIsOpen(false)} className="text-slate-200 hover:text-white focus:outline-none">[</button>
            <div className="pl-4 border-l border-slate-700">
                {data.map((value, index) => (
                    <div key={index} className="flex">
                       <div className="flex-grow">
                           <JsonValue value={value} />
                           {index < data.length - 1 && <span className="text-slate-200">,</span>}
                       </div>
                    </div>
                ))}
            </div>
            <span className="text-slate-200">]</span>
        </div>
    );
};

// Add display name for JsonArrayComponent
JsonArrayComponent.displayName = 'JsonArrayComponent';

const JsonViewer: React.FC<{ data: JsonValue }> = ({ data }) => {
    if (data === undefined || data === null) {
        return <div className="p-4 text-slate-400">No data available for this response.</div>;
    }
    
    if (typeof data === 'object' && Object.keys(data).length === 0) {
       return <div className="p-4 text-slate-400">Response is an empty object or array.</div>;
    }

    return <JsonValue value={data} />;
};

export default JsonViewer;
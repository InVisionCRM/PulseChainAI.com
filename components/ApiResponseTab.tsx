import React, { useState, useEffect } from 'react';
import JsonViewer from './JsonViewer';

const API_ENDPOINT_MAP: Record<string, string> = {
    contract: '/v2/smart-contracts/{address}',
    tokenInfo: '/v2/tokens/{address}',
    addressInfo: '/v2/addresses/{address}',
    readMethods: '/v2/smart-contracts/{address}/methods-read',
    creatorTxs: '/v2/addresses/{creator_address}/transactions',
    creatorBalances: '/v2/addresses/{creator_address}/token-balances'
};

const TAB_NAME_MAP: Record<string, string> = {
    contract: 'Contract',
    tokenInfo: 'Token Info',
    addressInfo: 'Address Info',
    readMethods: 'Read Methods',
    creatorTxs: 'Creator Txs',
    creatorBalances: 'Creator Balances',
};

const SubTabButton: React.FC<{ name: string; tabId: string; activeTab: string; onClick: (tabId: string) => void; }> = ({ name, tabId, activeTab, onClick }) => {
    const isActive = activeTab === tabId;
    return (
        <button
            onClick={() => onClick(tabId)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none flex-shrink-0 ${isActive ? 'text-white bg-purple-600' : 'text-slate-300 hover:bg-slate-700'}`}
            aria-selected={isActive.toString()}
            aria-controls={`panel-${tabId}`}
            role="tab"
        >
            {name}
        </button>
    );
};


const ApiResponseTab: React.FC<{ responses: Record<string, unknown> }> = ({ responses }) => {
    const availableTabs = Object.keys(responses).filter(key => responses[key] !== undefined && responses[key] !== null);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    
    useEffect(() => {
        if(availableTabs.length > 0 && !availableTabs.includes(activeTab || '')) {
            setActiveTab(availableTabs[0]);
        } else if (availableTabs.length === 0) {
            setActiveTab(null);
        }
    }, [responses, activeTab, availableTabs]);

    if (availableTabs.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-slate-400 h-full">
                No API responses to display. Load a contract first.
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-2 border-b border-slate-700 bg-slate-900/50">
                <div className="flex items-center gap-2 overflow-x-auto" role="tablist">
                    {availableTabs.map(key => (
                        <SubTabButton
                            key={key}
                            name={TAB_NAME_MAP[key] || key}
                            tabId={key}
                            activeTab={activeTab || ''}
                            onClick={setActiveTab}
                        />
                    ))}
                </div>
            </div>
            <div className="flex-grow overflow-hidden">
                {availableTabs.map(key => (
                    <div key={key} role="tabpanel" id={`panel-${key}`} hidden={activeTab !== key} className="h-full flex flex-col">
                         <div className="p-2 bg-slate-900 text-xs text-slate-400 font-mono border-b border-slate-700">
                            GET {API_ENDPOINT_MAP[key] || ''}
                         </div>
                         <div className="flex-grow overflow-auto p-4 font-mono text-sm">
                            <JsonViewer data={responses[key]} />
                         </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ApiResponseTab;
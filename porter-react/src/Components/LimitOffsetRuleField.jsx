import React from 'react';

export default function LimitOffsetRuleField({ rule, index, removeLimitOffsetRule, handleLimitOffsetChange }) {
        const [localLimit, setLocalLimit] = React.useState(rule.limit ?? 1000);
        const [localOffset, setLocalOffset] = React.useState(rule.offset ?? 0);

        React.useEffect(() => {
            setLocalLimit(rule.limit ?? 1000);
        }, [rule.limit]);
        React.useEffect(() => {
            setLocalOffset(rule.offset ?? 0);
        }, [rule.offset]);

        const commitLimit = () => {
            const parsed = Number.isFinite(Number(localLimit)) ? Number(localLimit) : 1000;
            handleLimitOffsetChange(index, 'limit', parsed);
        };
        const commitOffset = () => {
            const parsed = Number.isFinite(Number(localOffset)) ? Number(localOffset) : 0;
            handleLimitOffsetChange(index, 'offset', parsed);
        };

        return (
            <div className="limit-offset-field">
                Limit & Offset
                <button onClick={() => removeLimitOffsetRule(index)} className='remove-rule-button'>✖</button>
                <input
                    type="number"
                    value={localLimit}
                    placeholder='Limit, default 1000'
                    onChange={(e) => setLocalLimit(e.target.value)}
                    onBlur={commitLimit}
                />
                <input
                    type="number"
                    value={localOffset}
                    placeholder='Offset, default 0'
                    onChange={(e) => setLocalOffset(e.target.value)}
                    onBlur={commitOffset}
                />
            </div>
        );
    };

import React from 'react';

// wow, such limit, much offset
// actually might be the smallest component in the codebase written by me?
export default function LimitOffsetRuleField({ rule, index, removeLimitOffsetRule, handleLimitOffsetChange }) {

        // Local state to manage input values before committing
        const [localLimit, setLocalLimit] = React.useState(rule.limit ?? 1000);
        const [localOffset, setLocalOffset] = React.useState(rule.offset ?? 0);

        // Sync local state with props when they change
        React.useEffect(() => {
            setLocalLimit(rule.limit ?? 1000); // Default to 1000 if undefined
        }, [rule.limit]);
        React.useEffect(() => {
            setLocalOffset(rule.offset ?? 0); // Default to 0 if undefined. You don't want offset to be above 0 by default. Trust me.
        }, [rule.offset]);

        // Commit limit changes to parent component
        const commitLimit = () => {
            const parsed = Number.isFinite(Number(localLimit)) ? Number(localLimit) : 1000;
            handleLimitOffsetChange(index, 'limit', parsed);
        };
        // Commit offset changes to parent component
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

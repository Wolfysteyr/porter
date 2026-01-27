import React from "react";
import Select from "react-select";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

export default function FRRuleField({
    rule,
    index,
    FRRules,
    findOptions,
    findOptionsLoading,
    removeFRRule,
    handleFRRuleChange,
}) {
    // compute values selected by other FR rules (exclude current index)
    const selectedValues = new Set(
        FRRules.map((r, i) => (i !== index ? r.find : null)).filter(
            (v) => v !== null && v !== undefined && v !== "",
        ),
    );

    const groupedOptions = Object.entries(findOptions || {}).map(
        ([col, vals]) => {
            const opts = (Array.isArray(vals) ? vals : [])
                .map((val) => {
                    const valueStr =
                        val === null || val === undefined ? "" : String(val);
                    return {
                        value: `${col}::${valueStr}`,
                        label: valueStr === "" ? "<empty>" : valueStr,
                    };
                })
                .filter((opt) => {
                    // Always keep the option if it corresponds to the current rule's selected value
                    if (
                        rule.find &&
                        (opt.value === rule.find ||
                            opt.value.endsWith(`::${rule.find}`))
                    ) {
                        return true;
                    }
                    // Exclude option if any other rule has selected the same value (match by exact or endsWith '::value')
                    for (const sv of selectedValues) {
                        if (opt.value === sv || opt.value.endsWith(`::${sv}`))
                            return false;
                    }
                    return true;
                });

            return { label: col, options: opts };
        },
    );

    // find selected option object matching the stored rule.find value
    let selectedOption = null;
    if (rule.find) {
        for (const group of groupedOptions) {
            const match = group.options.find(
                (o) =>
                    o.value === rule.find || o.value.endsWith(`::${rule.find}`),
            );
            if (match) {
                selectedOption = match;
                break;
            }
        }
        if (!selectedOption) {
            const parts = rule.find.split("::");
            const label =
                parts.length > 1 ? parts.slice(1).join("::") : parts[0];
            selectedOption = { value: rule.find, label };
        }
    }

    // local state for replace input to avoid focus loss while typing
    const [localReplace, setLocalReplace] = React.useState(rule.replace ?? "");

    // keep localReplace in sync when rule.replace changes from outside
    React.useEffect(() => {
        setLocalReplace(rule.replace ?? "");
    }, [rule.replace]);

    return (
        <div className="FRrule-field">
            <Tippy content="Find the value from the provided list, then replace it with desired text/number/value">
                <span>ℹ️</span>
            </Tippy>
            Find & Replace
            <button
                onClick={() => removeFRRule(index)}
                className="remove-rule-button"
            >
                ✖
            </button>
            <Select
                options={groupedOptions}
                value={selectedOption}
                onChange={(opt) => {
                    const token = opt ? opt.value : "";
                    const value = token.includes("::")
                        ? token.split("::").slice(1).join("::")
                        : token;
                    handleFRRuleChange(index, "find", value);
                }}
                isSearchable={true}
                isClearable={true}
                isLoading={findOptionsLoading}
                placeholder="Find... (type to search)"
                noOptionsMessage={() =>
                    findOptionsLoading ? "Loading..." : "No values"
                }
                styles={{
                    menu: (provided) => ({
                        ...provided,
                        zIndex: 9999,
                        backgroundColor: "#424242",
                        color: "#fff",
                    }),
                    control: (provided) => ({
                        ...provided,
                        margin: "1rem",
                        backgroundColor: "#424242",
                        color: "#fff",
                    }),
                    singleValue: (provided) => ({ ...provided, color: "#fff" }),
                }}
            />
            {rule.find && (
                <>
                    <input
                        type="text"
                        placeholder="Replace with..."
                        value={localReplace}
                        onChange={(e) => setLocalReplace(e.target.value)}
                        onBlur={() =>
                            handleFRRuleChange(index, "replace", localReplace)
                        }
                    />
                </>
            )}
        </div>
    );
}

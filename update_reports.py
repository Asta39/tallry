import os
import glob
import re

files = glob.glob("src/app/\(app\)/reports/**/*.tsx", recursive=True)
files = [f for f in files if f.endswith("page.tsx")]

for f in files:
    with open(f, "r") as file:
        content = file.read()
    
    # Skip if already modified
    if "props: { searchParams:" in content or "parsePeriod" in content:
        continue

    # We need to find the export default async function
    func_match = re.search(r'export default async function ([A-Za-z0-9_]+)\(\) {', content)
    if not func_match:
        continue
    
    func_name = func_match.group(1)
    
    # 1. Update function signature
    new_func = f"export default async function {func_name}(props: {{ searchParams: Promise<{{ period?: string, as_of?: string }}> }}) {{\n  const searchParams = await props.searchParams;\n  const period = searchParams.period || 'this_month';\n"
    content = content.replace(f"export default async function {func_name}() {{", new_func)

    # Add parsePeriod import if not there
    if "import { parsePeriod" not in content and "parsePeriod" not in content:
        if 'from "@/lib/reports"' in content:
            content = content.replace('from "@/lib/reports"', 'from "@/lib/reports"\nimport { parsePeriod } from "@/lib/reports";')
        else:
            content = content.replace('export default async function', 'import { parsePeriod } from "@/lib/reports";\n\nexport default async function')
            
    # Remove the old hardcoded dates pattern
    old_dates = r'  const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);\n  const currentMonth = today\.slice\(0, 7\);\n  const fromDate = `\$\{currentMonth\}-01`;\n  const toDate = today;'
    new_dates = r'  const { fromDate, toDate } = parsePeriod(period);'
    content = re.sub(old_dates, new_dates, content)
    
    # Change <div className="flex flex-col md:flex-row gap-4 items-end"> to <form ...>
    # Wait, some pages might have it different. Let's look for the label Period.
    # Replace the wrapper div with form
    
    # The common pattern is:
    # <div className="flex flex-col md:flex-row gap-4 items-end">
    #   <div className="flex-1">
    #     <label ...>Period</label>
    #     <select ... defaultValue="this_month">
    
    # Replace <select ... defaultValue="this_month"> with defaultValue={period} name="period"
    content = re.sub(r'<select([^>]+)defaultValue="this_month"', r'<select\1name="period" defaultValue={period}', content)
    
    # Wrap the period controls in a form. We will find <div className="card p-5 mb-6 ...">
    content = content.replace(
        '<div className="card p-5 mb-6 bg-[var(--color-ink-50)] border-dashed">\n        <div className="flex flex-col md:flex-row gap-4 items-end">',
        '<form method="GET" className="card p-5 mb-6 bg-[var(--color-ink-50)] border-dashed">\n        <div className="flex flex-col md:flex-row gap-4 items-end">'
    )
    # Then we need to replace the closing </div></div> of the card with </form>
    # This is tricky using simple string replacement.
    content = content.replace(
        '</button>\n        </div>\n      </div>',
        '</button>\n        </div>\n      </form>'
    )
    
    # Make sure we add type="submit" to the button if it's missing
    content = content.replace(
        '<button className="btn-primary',
        '<button type="submit" className="btn-primary'
    )

    # Some pages use different wrappers or have Run button.
    content = content.replace(
        '<button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-3 py-1.5">Run</button>',
        '<button type="submit" className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-3 py-1.5">Run</button>'
    )
    content = content.replace(
        '<button className="btn btn-primary">Run Report</button>',
        '<button type="submit" className="btn btn-primary">Run Report</button>'
    )
    
    with open(f, "w") as file:
        file.write(content)

print("Done updating reports.")

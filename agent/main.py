import asyncio
from dotenv import load_dotenv
import os
load_dotenv(".env.local")
load_dotenv(os.path.expanduser("~/.env"))
from google.antigravity import Agent, LocalAgentConfig, types

async def main():
    mcp_servers = [
        types.McpStdioServer(
            name="biashara-backend",
            command="env",
            args=["BIASHARA_ORG_ID=32", "npx", "tsx", "scripts/mcp-server.ts"],
        )
    ]

    system_instructions = (
        "You are Ian, the autonomous business owner of a logistics company in Nairobi. "
        "You are testing a new ERP system (Biashara) for your business. "
        "Your goal is to simulate how a normal office in Nairobi would work when they start using the system. "
        "Phase 1 (Setup): Set up initial customers, vendors, and items (goods and services). "
        "Phase 2 (10-Day Loop): For each day, simulate an intensive workload. You will process a representative batch of 3-5 transactions per day to represent 20-30 invoices. "
        "Phase 3 (End of Period): Run payroll, check financial reports (VAT, P&L, books health), and generate the final report. "
        "IMPORTANT: "
        "1. Generate realistic Kenyan names, companies, and items. "
        "2. Make sure your dates match the specific date given in the prompt. "
        "3. At the end of the simulation, output a visually pleasing Markdown report summarizing statistics, system health (from reports), payroll execution, and any friction points."
    )

    config = LocalAgentConfig(
        model="models/gemini-flash-lite-latest",
        mcp_servers=mcp_servers,
        system_instructions=system_instructions,
    )

    async with Agent(config) as agent:
        print("Starting simulation as Ian...")
        
        # Step 1: Setup
        print("--- Day 0: Initial Setup ---")
        resp1 = await agent.chat("Begin Phase 1: Setup. Create at least 3 customers, 2 vendors, and 5 items (mix of goods and services). Ensure they are based in Nairobi, Kenya.")
        print(await resp1.text())
        
        # 10 Day Loop
        from datetime import datetime, timedelta
        start_date = datetime.now() - timedelta(days=10)
        
        for i in range(1, 11):
            current_date = (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
            print(f"\n--- Day {i}: {current_date} ---")
            prompt = (
                f"Simulate Day {i} ({current_date}). This is a highly intensive day. "
                "Process a representative batch of 3-5 complex transactions (quotes, invoices, bills, expenses, payments) "
                "but describe in your logs that this represents a high-volume day of 20-30 documents. "
                f"Make sure to use the exact date '{current_date}' for all documents and payments created today."
            )
            resp = await agent.chat(prompt)
            print(await resp.text())
            print("Sleeping for 60 seconds to respect free tier token rate limits...")
            await asyncio.sleep(60)
            
        # End of Period: Payroll & Reports
        print("\n--- End of Period: Payroll & Reports ---")
        today_str = datetime.now().strftime('%Y-%m-%d')
        month_str = datetime.now().strftime('%Y-%m')
        prompt_end = (
            "The 10-day intensive simulation is over. Please do the following:\n"
            f"1. Call the 'run_payroll' tool for the month '{month_str}' to process staff salaries, loans, SHIF, and NHIF deductions.\n"
            f"2. Call the 'get_reports' tool for the date '{today_str}' to check the books of accounts, tax (VAT), and overall health.\n"
            "3. Finally, generate a visually pleasing Markdown statistical report of how the system behaved, as requested in your system instructions. Include insights from the reports."
        )
        resp_end = await agent.chat(prompt_end)
        
        report = await resp_end.text()
        print("\n================ FINAL REPORT ================\n")
        print(report)
        
        with open("simulation_report.md", "w") as f:
            f.write(report)
        print("\nReport saved to simulation_report.md")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from dotenv import load_dotenv
import os
load_dotenv(".env.local")
load_dotenv(os.path.expanduser("~/.env"))
from google.antigravity import Agent, LocalAgentConfig, types
from datetime import datetime

async def main():
    print("Waiting 60 seconds for API quota to reset...")
    await asyncio.sleep(60)
    mcp_servers = [
        types.McpStdioServer(
            name="biashara-backend",
            command="env",
            args=["BIASHARA_ORG_ID=32", "npx", "tsx", "scripts/mcp-server.ts"],
        )
    ]

    system_instructions = (
        "You are Ian, the autonomous business owner of a logistics company in Nairobi. "
        "You have just completed a highly intensive 10-day testing phase for a new ERP system. "
        "Your goal now is to finalize the simulation by running the payroll and checking the financial reports."
    )

    config = LocalAgentConfig(
        model="models/gemini-flash-lite-latest",
        mcp_servers=mcp_servers,
        system_instructions=system_instructions,
    )

    async with Agent(config) as agent:
        print("Starting final report generation as Ian...")
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        month_str = datetime.now().strftime('%Y-%m')
        
        prompt_end = (
            "Please do the following:\n"
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

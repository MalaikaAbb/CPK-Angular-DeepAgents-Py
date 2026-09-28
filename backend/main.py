from deepagents import create_deep_agent
from copilotkit import CopilotKitMiddleware

def getWeather(location: str):
    """Get weather for a location"""
    return f"The weather in {location} is sunny."

agent = create_deep_agent(
    model="openai:gpt-5.4-mini",
    tools=[getWeather],
    middleware=[CopilotKitMiddleware()], # for frontend tools and context
    system_prompt="You are a helpful research assistant.",
)
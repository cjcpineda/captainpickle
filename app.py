import streamlit as st

st.title("Captain Pickle")
st.write("Hello world! The app is running.")

# Day 1 check: confirms the secret exists without ever showing it
if "ANTHROPIC_API_KEY" in st.secrets:
    st.success("API key found in secrets.")
else:
    st.warning("API key not set yet.")
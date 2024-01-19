
import os
from azure.communication.networktraversal import CommunicationRelayClient
from azure.identity import DefaultAzureCredential
from azure.communication.identity import CommunicationIdentityClient

try:
   print("Azure Communication Services - Access Relay Configuration  Quickstart")
   connection_str = "endpoint=https://demoavatar.europe.communication.azure.com/;accesskey=390U8FMzrqvdoYGq9GLDGmPDd8/FZp0no/J8L18hzsVaUJKt9a7maEwi8fSJJO2HDd9b6wVGWropNGBKEZTBKA=="
   identity_client = CommunicationIdentityClient.from_connection_string(connection_str)
   relay_client = CommunicationRelayClient.from_connection_string(connection_str)

   user = identity_client.create_user()

   relay_configuration = relay_client.get_relay_configuration()

   for iceServer in relay_configuration.ice_servers:
        assert iceServer.username is not None
        print('Username: ' + iceServer.username)

        assert iceServer.credential is not None
        print('Credential: ' + iceServer.credential)
        
        assert iceServer.urls is not None
        for url in iceServer.urls:
            print('Url:' + url)


except Exception as ex:
   print("Exception:")
   print(ex)

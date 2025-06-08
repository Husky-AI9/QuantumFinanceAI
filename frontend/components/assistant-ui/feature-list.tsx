import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import {NewsSynthesizer} from "./news"
import {SentimentAnalyzer} from "./sentiment"
import {RiskIdentifier} from "./risks"
import FinancialAssistantChat from "./assist"

export function FinancialToolkit() {
  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="account">New Synthesis</TabsTrigger>
        <TabsTrigger value="password">Sentiment</TabsTrigger>
        <TabsTrigger value="risk">Risk</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>

      </TabsList>
      <TabsContent value="account">
        <NewsSynthesizer></NewsSynthesizer>
      </TabsContent>
      <TabsContent value="password">
        <SentimentAnalyzer></SentimentAnalyzer>
      </TabsContent>
      <TabsContent value="risk">
        <RiskIdentifier></RiskIdentifier>
      </TabsContent>
      <TabsContent value="chat" className="flex-grow h-0 max-h-[80vh] overflow-y-auto">
        <FinancialAssistantChat></FinancialAssistantChat>
      </TabsContent>
    </Tabs>
  )
}
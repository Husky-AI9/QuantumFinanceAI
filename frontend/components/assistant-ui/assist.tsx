// src/components/FinancialAssistantChat.tsx
import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SendHorizonal, Bot, User, AlertCircle } from 'lucide-react';

// Define the structure for a message
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'error';
}

// Define the expected API error structure
interface AssistApiError {
  detail?: string | { msg: string; type: string }[];
}

const FinancialAssistantChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const question = inputValue.trim();
    if (!question) return;

    setMessages((prevMessages) => [
      ...prevMessages,
      { id: Date.now().toString() + '-user', text: question, sender: 'user' },
    ]);
    setInputValue('');
    setIsLoading(true);

    try {
      const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT; 
      const API_URL = `https://localhost:${mlflowPort}/invocations`;
      const mlflowRequestBody = {
        inputs: {
          action: "assist",
          question: question
        },
        params: {} 
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mlflowRequestBody),
      });


      if (!response.ok) {
        const errorData: AssistApiError = await response.json();
        let errorMessage = `API Error: ${response.status}`;
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            errorMessage = errorData.detail.map(d => d.msg).join(', ');
          }
        }
        throw new Error(errorMessage);
      }

      let data = await response.json();
      data = data.predictions[0][0]

      setMessages((prevMessages) => [
        ...prevMessages,
        { id: Date.now().toString() + '-ai', text: data, sender: 'ai' },
      ]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessageText = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setMessages((prevMessages) => [
        ...prevMessages,
        { id: Date.now().toString() + '-error', text: `Error: ${errorMessageText}`, sender: 'error' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bot className="mr-2 h-6 w-6 text-blue-500" />
          Financial Assistant
        </CardTitle>
      </CardHeader>
      {/* MODIFICATION 2: Remove fixed height h-[500px], ensure flex-grow */}
      <CardContent className="flex flex-col flex-grow"> {/* Ensure CardContent can grow */}
        <ScrollArea className="flex-grow p-4 border rounded-md mb-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg shadow ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.sender === 'ai'
                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-50'
                      : 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 border border-red-500'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.sender === 'ai' && <Bot className="h-5 w-5 flex-shrink-0 text-blue-500" />}
                    {message.sender === 'user' && <User className="h-5 w-5 flex-shrink-0" />}
                    {message.sender === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />}
                    <p className="text-sm whitespace-pre-wrap overflow-x-auto min-w-0">
                      {message.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[70%] p-3 rounded-lg shadow bg-slate-100 dark:bg-slate-700">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-blue-500 animate-pulse" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Thinking...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 mt-auto pt-2"> {/* mt-auto pushes form to bottom if CardContent has extra space */}
          <Input
            type="text"
            placeholder="Ask a financial question..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            className="flex-grow"
            aria-label="Ask a financial question"
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()} size="icon">
            <SendHorizonal className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default FinancialAssistantChat;
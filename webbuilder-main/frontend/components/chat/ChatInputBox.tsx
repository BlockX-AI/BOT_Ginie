import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Paperclip, Settings, ArrowUp } from "lucide-react";
import { useState } from "react";

interface ChatInputBoxProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onModelChange?: (model: string) => void;
}

export function ChatInputBox({
  input,
  isLoading,
  onInputChange,
  onSubmit,
  onModelChange,
}: ChatInputBoxProps) {
  const [selectedModel, setSelectedModel] = useState("Gemini 2.5-pro");

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    if (onModelChange) {
      onModelChange(model);
    }
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm hover:border-white/20 transition-colors">
        <Input
          type="text"
          placeholder="GM GM! What you wanna ship on chain?"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={isLoading}
          className="border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 text-lg"
        />

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-white"
            >
              <Plus size={20} />
            </button>
            <button
              type="button"
              className="p-2 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-white"
            >
              <Paperclip size={20} />
            </button>
            <select 
              value={selectedModel}
              onChange={handleModelChange}
              className="bg-transparent text-white text-sm px-2 py-1 hover:bg-white/10 rounded transition outline-none cursor-pointer"
            >
              <option value="Gemini 2.5-pro">Gemini 2.5-pro</option>
              <option value="Gemini 2.5-flash">Gemini 2.5-flash</option>
              <option value="GPT-4">GPT-4</option>
              <option value="Claude 3">Claude 3</option>
              <option value="Mistral">Mistral</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-white"
            >
              <Settings size={20} />
            </button>
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="icon"
              className="rounded-lg w-8 h-8 bg-white text-black hover:bg-slate-100"
            >
              <ArrowUp size={18} />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

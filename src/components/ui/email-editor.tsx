import React, { useState } from "react";
import { Textarea } from "./textarea";
import { Button } from "./button";
import { Eye, Edit2 } from "lucide-react";

interface EmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

/**
 * Parses basic markdown links [text](url) into actual HTML <a> tags.
 * Preserves newlines as <br /> for display purposes.
 */
export function formatEmailBodyToHtml(text: string) {
  if (!text) return "";
  
  // Escape HTML first to prevent injection
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
    
  // Replace markdown links [Contact Us](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g, 
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">$1</a>'
  );
  
  // Replace newlines
  html = html.replace(/\n/g, "<br />");
  return html;
}

export function EmailEditor({ value, onChange, rows = 12 }: EmailEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant={!isPreview ? "default" : "outline"}
          size="sm"
          onClick={() => setIsPreview(false)}
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button
          type="button"
          variant={isPreview ? "default" : "outline"}
          size="sm"
          onClick={() => setIsPreview(true)}
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
      </div>

      {isPreview ? (
        <div 
          className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm whitespace-pre-wrap font-sans"
          dangerouslySetInnerHTML={{ __html: formatEmailBodyToHtml(value) }}
        />
      ) : (
        <Textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

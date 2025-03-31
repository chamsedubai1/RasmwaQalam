import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertCircle, InfoIcon } from 'lucide-react';

interface PasswordRule {
  regex: RegExp;
  text: string;
  checked: boolean;
}

interface PasswordCheckProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordCheckProps) {
  const [strength, setStrength] = useState(0);
  const [rules, setRules] = useState<PasswordRule[]>([
    { regex: /.{8,}/, text: "At least 8 characters", checked: false },
    { regex: /[A-Z]/, text: "At least one uppercase letter", checked: false },
    { regex: /[0-9]/, text: "At least one number", checked: false },
    { regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?\s]+.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?\s]+/, text: "At least two special characters", checked: false },
  ]);

  useEffect(() => {
    // Update rule checks
    const updatedRules = rules.map(rule => ({
      ...rule,
      checked: rule.regex.test(password)
    }));
    
    // Calculate strength
    const passedRules = updatedRules.filter(rule => rule.checked).length;
    setStrength(passedRules * 25); // 25% for each passed rule
    
    setRules(updatedRules);
  }, [password]);

  const getStrengthLabel = (): { color: string; text: string } => {
    if (strength === 0) return { color: 'text-gray-400', text: 'Empty' };
    if (strength < 50) return { color: 'text-red-500', text: 'Weak' };
    if (strength < 100) return { color: 'text-yellow-500', text: 'Medium' };
    return { color: 'text-green-500', text: 'Strong' };
  };

  const getProgressColor = (): string => {
    if (strength === 0) return 'bg-gray-200';
    if (strength < 50) return 'bg-red-500';
    if (strength < 100) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const label = getStrengthLabel();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Password Strength</span>
        <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
      </div>
      
      <Progress value={strength} className={`h-1.5 ${getProgressColor()}`} />
      
      <div className="space-y-1.5 mt-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-start gap-1.5 text-xs">
            {rule.checked ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            )}
            <span className={rule.checked ? 'text-muted-foreground' : 'text-foreground'}>
              {rule.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
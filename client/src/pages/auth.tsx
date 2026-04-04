import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { loginRequestSchema, registerRequestSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(2, "Никнейм должен содержать минимум 2 символа"),
  password: z.string().min(1, "Пароль обязателен"),
});

type LoginForm = z.infer<typeof loginRequestSchema>;
type RegisterForm = z.infer<typeof registerRequestSchema>;

interface AuthPageProps {
  onSuccess: () => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const [activeTab, setActiveTab] = useState("login");
  const { toast } = useToast();
  const authInputClassName =
    "border-neutral-200 bg-white text-neutral-950 placeholder:text-neutral-500 focus-visible:ring-white/70 focus-visible:ring-offset-neutral-950";

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      phone: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка авторизации");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Авторизация прошла успешно",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Ошибка авторизации",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка регистрации");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Регистрация прошла успешно",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Ошибка регистрации",
        variant: "destructive",
      });
    },
  });

  const onLoginSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  const handleGuestLogin = async () => {
    try {
      const response = await fetch("/api/auth/guest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Ошибка создания гостевой сессии");
      }

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Успех",
          description: `Гостевая сессия создана для ${data.user.username}`,
        });
        onSuccess();
      } else {
        throw new Error(data.message || "Ошибка создания гостевой сессии");
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Ошибка создания гостевой сессии",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-white/10 bg-white/[0.04] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <a
            href="/"
            className="mx-auto flex w-fit flex-col items-center rounded-2xl px-3 py-2 transition-opacity hover:opacity-80"
          >
            <CardTitle className="text-4xl font-bold text-white">
              ChessMaster
            </CardTitle>
          </a>
          <CardDescription className="text-white/65">
            Авторизуйтесь или зарегистрируйтесь для игры
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 border border-white/10 bg-white/5">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Никнейм</Label>
                  <Input
                    id="login-username"
                    {...loginForm.register("username")}
                    placeholder="Введите никнейм"
                    className={authInputClassName}
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-red-500">
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Пароль</Label>
                  <Input
                    id="login-password"
                    type="password"
                    {...loginForm.register("password")}
                    placeholder="Введите пароль"
                    className={authInputClassName}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-red-500">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-neutral-200"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Вход..." : "Войти"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Никнейм</Label>
                  <Input
                    id="register-username"
                    {...registerForm.register("username")}
                    placeholder="Выберите никнейм (2-50 символов)"
                    className={authInputClassName}
                  />
                  {registerForm.formState.errors.username && (
                    <p className="text-sm text-red-500">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Пароль</Label>
                  <Input
                    id="register-password"
                    type="password"
                    {...registerForm.register("password")}
                    placeholder="Минимум 6 символов (буквы и цифры)"
                    className={authInputClassName}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-red-500">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    {...registerForm.register("email")}
                    placeholder="email@example.com"
                    className={authInputClassName}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-red-500">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-phone">Телефон</Label>
                  <Input
                    id="register-phone"
                    {...registerForm.register("phone")}
                    placeholder="+7 (999) 123-45-67"
                    className={authInputClassName}
                  />
                  {registerForm.formState.errors.phone && (
                    <p className="text-sm text-red-500">
                      {registerForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-neutral-200"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Регистрация..." : "Зарегистрироваться"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={handleGuestLogin}
              className="w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Продолжить как гость
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

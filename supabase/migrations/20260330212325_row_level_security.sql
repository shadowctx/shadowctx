-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_tags ENABLE ROW LEVEL SECURITY;

-- Helper function: is user a member of workspace?
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: user's role in workspace
CREATE OR REPLACE FUNCTION public.workspace_role(ws_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view workspace members' profiles"
  ON public.users FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = users.id
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (id = auth.uid());

-- Workspaces policies
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT USING (public.is_workspace_member(id));

CREATE POLICY "Any user can create a workspace"
  ON public.workspaces FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners and admins can update workspace"
  ON public.workspaces FOR UPDATE USING (
    public.workspace_role(id) IN ('owner', 'admin')
  );

CREATE POLICY "Owners can delete workspace"
  ON public.workspaces FOR DELETE USING (
    public.workspace_role(id) = 'owner'
  );

-- Workspace members policies
CREATE POLICY "Members can view workspace membership"
  ON public.workspace_members FOR SELECT USING (
    public.is_workspace_member(workspace_id)
  );

CREATE POLICY "Owners and admins can add members"
  ON public.workspace_members FOR INSERT WITH CHECK (
    public.workspace_role(workspace_id) IN ('owner', 'admin')
    OR user_id = auth.uid()  -- allow self-join for workspace creator
  );

CREATE POLICY "Owners and admins can update membership"
  ON public.workspace_members FOR UPDATE USING (
    public.workspace_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "Owners can remove members"
  ON public.workspace_members FOR DELETE USING (
    public.workspace_role(workspace_id) IN ('owner', 'admin')
    OR user_id = auth.uid()  -- allow self-removal
  );

-- Entries policies
CREATE POLICY "Members can view entries in their workspaces"
  ON public.entries FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create entries in their workspaces"
  ON public.entries FOR INSERT WITH CHECK (
    public.is_workspace_member(workspace_id) AND author_id = auth.uid()
  );

CREATE POLICY "Authors and admins can update entries"
  ON public.entries FOR UPDATE USING (
    author_id = auth.uid()
    OR public.workspace_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "Authors and admins can delete entries"
  ON public.entries FOR DELETE USING (
    author_id = auth.uid()
    OR public.workspace_role(workspace_id) IN ('owner', 'admin')
  );

-- Tags policies
CREATE POLICY "Members can view tags"
  ON public.tags FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create tags"
  ON public.tags FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can update tags"
  ON public.tags FOR UPDATE USING (
    public.workspace_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete tags"
  ON public.tags FOR DELETE USING (
    public.workspace_role(workspace_id) IN ('owner', 'admin')
  );

-- Entry tags policies
CREATE POLICY "Members can view entry tags"
  ON public.entry_tags FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND public.is_workspace_member(e.workspace_id)
    )
  );

CREATE POLICY "Members can tag entries"
  ON public.entry_tags FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND public.is_workspace_member(e.workspace_id)
    )
  );

CREATE POLICY "Members can remove entry tags"
  ON public.entry_tags FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND public.is_workspace_member(e.workspace_id)
    )
  );
